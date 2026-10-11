import { createServer, STATUS_CODES, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { guardRequest, SECURITY_HEADERS } from './http-guard'
import { createApi, type ApiOptions } from './routes'
import type { StaticFile } from './static-files'

interface OfficeServerOptions extends Omit<ApiOptions, 'onWatchers'> {
  files: ReadonlyMap<string, StaticFile>
  token: string
  // How long the server may sit with no page watching before onIdle is called.
  idleMs: number
  onIdle: () => void
  // Called once, at the first call that carried the launch token.
  onFirstUse: () => void
}

export interface OfficeServer {
  listen(port: number): Promise<AddressInfo>
  close(): Promise<void>
}

function refuse(response: ServerResponse, status: number): void {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(STATUS_CODES[status])
}

export function createOfficeServer(options: OfficeServerOptions): OfficeServer {
  const { files, token, idleMs, onIdle, onFirstUse } = options
  let port = 0
  let isUsed = false
  let isClosed = false
  let idleTimer: NodeJS.Timeout | null = null

  const countIdleTime = (watchers: number): void => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = watchers === 0 && !isClosed ? setTimeout(onIdle, idleMs) : null
  }
  const api = createApi({ ...options, onWatchers: countIdleTime })

  const server = createServer((request, response) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value)
    const verdict = guardRequest(request, { port, token })
    if (!verdict.allowed) return refuse(response, verdict.status)
    if (!verdict.isApi) {
      // A lookup by exact path: nothing a request says is ever joined to a folder.
      const file = files.get(verdict.path)
      if (!file) return refuse(response, 404)
      response.writeHead(200, { 'Content-Type': file.contentType })
      return response.end(file.body)
    }
    if (!isUsed) {
      isUsed = true
      onFirstUse()
    }
    api(request, response, verdict.path).catch(() => response.destroy())
  })

  return {
    listen: (requestedPort) =>
      new Promise((resolve, reject) => {
        server.once('error', reject)
        // IPv4 loopback by address: never a hostname, never every interface.
        server.listen({ port: requestedPort, host: '127.0.0.1', exclusive: true }, () => {
          const address = server.address()
          if (address === null || typeof address === 'string') {
            return reject(new Error('Office server has no TCP address'))
          }
          port = address.port
          countIdleTime(0)
          resolve(address)
        })
      }),
    close: () =>
      new Promise((resolve) => {
        isClosed = true
        countIdleTime(0)
        server.close(() => resolve())
        // Feeds are open-ended responses; without this, close would wait on them for ever.
        server.closeAllConnections()
      })
  }
}
