import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedMessage } from '../shared/office/types'
import { createOfficeServer, type OfficeServer } from './server'

const TOKEN = 'k'.repeat(43)
const files = new Map([
  [
    '/office.html',
    { body: Buffer.from('<!doctype html>'), contentType: 'text/html; charset=utf-8' }
  ]
])

interface Reply {
  status: number
  headers: IncomingHttpHeaders
  body: string
}

describe('createOfficeServer', () => {
  let server: OfficeServer
  let port: number
  const onIdle = vi.fn()
  const onFirstUse = vi.fn()
  const bridge = { start: vi.fn(), stop: vi.fn() }
  const service = {
    subscribe: vi.fn(),
    focus: vi.fn(),
    send: vi.fn(),
    respond: vi.fn(),
    peek: vi.fn(),
    startAgent: vi.fn()
  }

  // Sent over a real socket with the headers exactly as given, Host included.
  function send(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: string
  ): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method,
          path,
          headers: { host: `127.0.0.1:${port}`, ...headers }
        },
        (response) => {
          let text = ''
          response.setEncoding('utf8')
          response.on('data', (chunk: string) => (text += chunk))
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: text })
          )
        }
      )
      request.on('error', reject)
      request.end(body)
    })
  }
  const pageHeaders = (): Record<string, string> => ({
    authorization: `Bearer ${TOKEN}`,
    origin: `http://127.0.0.1:${port}`,
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json'
  })
  const focus = (headers: Record<string, string>): Promise<Reply> =>
    send('POST', '/api/focus', headers, '{"agentKey":"claude:s1"}')

  async function start(options: { interactive?: boolean; idleMs?: number } = {}): Promise<void> {
    server = createOfficeServer({
      files,
      token: TOKEN,
      service,
      bridge,
      interactive: options.interactive ?? false,
      idleMs: options.idleMs ?? 60_000,
      onIdle,
      onFirstUse
    })
    const address = await server.listen(0)
    port = address.port
    expect(address).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    service.subscribe.mockReturnValue(() => undefined)
    service.focus.mockResolvedValue({ success: true, target: 'pane' })
    service.send.mockResolvedValue({ success: true })
  })

  afterEach(() => server.close())

  it('listens on the IPv4 loopback address and nowhere else', async () => {
    await start()
    expect(port).toBeGreaterThan(0)
  })

  it('serves the page with headers that forbid framing and cross-origin use', async () => {
    await start()
    const reply = await send('GET', '/office.html')

    expect(reply).toMatchObject({ status: 200, body: '<!doctype html>' })
    expect(reply.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(reply.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(reply.headers['x-frame-options']).toBe('DENY')
    expect(reply.headers['x-content-type-options']).toBe('nosniff')
    expect(reply.headers['cache-control']).toBe('no-store')
  })

  it.each([
    '/..%2f..%2fetc/passwd',
    '/../server.mjs',
    '/assets/../../MANIFEST.json',
    '/office.html/../../server.mjs',
    '/%2e%2e/office.html',
    '/MANIFEST.json',
    '/server.mjs',
    '/'
  ])('answers 404 to %s, which is not a listed page file', async (path) => {
    await start()
    expect((await send('GET', path)).status).toBe(404)
  })

  it.each(['localhost', 'evil.test'])('refuses a request addressed to %s', async (name) => {
    await start()
    const host = `${name}:${port}`

    expect((await send('GET', '/office.html', { host })).status).toBe(403)
    expect((await focus({ ...pageHeaders(), host })).status).toBe(403)
    expect(service.focus).not.toHaveBeenCalled()
  })

  it('refuses an API call from another origin, even one on this machine', async () => {
    await start()

    expect((await focus({ ...pageHeaders(), origin: 'http://127.0.0.1:5173' })).status).toBe(403)
    expect((await focus({ ...pageHeaders(), 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect(service.focus).not.toHaveBeenCalled()
  })

  it('refuses an API call without the launch token, or with another one', async () => {
    await start()
    const { authorization: _omitted, ...withoutToken } = pageHeaders()

    expect((await focus(withoutToken)).status).toBe(401)
    expect(
      (await focus({ ...pageHeaders(), authorization: `Bearer ${'x'.repeat(43)}` })).status
    ).toBe(401)
    expect((await send('GET', '/api/feed')).status).toBe(401)
    expect(service.focus).not.toHaveBeenCalled()
    expect(service.subscribe).not.toHaveBeenCalled()
  })

  it('passes a call from its own page, with the token, to the API', async () => {
    await start()
    const reply = await focus(pageHeaders())

    expect(reply.status).toBe(200)
    expect(JSON.parse(reply.body)).toEqual({ success: true, target: 'pane' })
    expect(service.focus).toHaveBeenCalledExactlyOnceWith('claude:s1')
  })

  it('refuses to type into a terminal unless it was started interactive', async () => {
    await start()
    const reply = await send(
      'POST',
      '/api/send',
      pageHeaders(),
      '{"sessionKey":"claude:s1","text":"hello"}'
    )

    expect(reply.status).toBe(403)
    expect(JSON.parse(reply.body)).toEqual({ success: false, reason: 'not-permitted' })
    expect(service.send).not.toHaveBeenCalled()
  })

  it('types into a terminal when started interactive', async () => {
    await start({ interactive: true })
    const reply = await send(
      'POST',
      '/api/send',
      pageHeaders(),
      '{"sessionKey":"claude:s1","text":"hello"}'
    )

    expect(reply.status).toBe(200)
    expect(service.send).toHaveBeenCalledExactlyOnceWith('claude:s1', 'hello')
  })

  it('answers a preflight with 405 and never sends a cross-origin header', async () => {
    await start()
    const replies = await Promise.all([
      send('OPTIONS', '/api/send', {
        origin: 'https://evil.test',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization'
      }),
      send('GET', '/office.html'),
      send('GET', '/missing.js'),
      focus(pageHeaders()),
      focus({ ...pageHeaders(), origin: 'https://evil.test' })
    ])

    expect(replies[0].status).toBe(405)
    for (const reply of replies) {
      const names = Object.keys(reply.headers).filter((name) => name.startsWith('access-control-'))
      expect(names).toEqual([])
      expect(reply.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    }
  })

  it('reports its first authorised call once, so the launch file can be removed', async () => {
    await start()
    await send('GET', '/office.html')
    await focus({ ...pageHeaders(), authorization: 'Bearer wrong' })
    expect(onFirstUse).not.toHaveBeenCalled()

    await focus(pageHeaders())
    await focus(pageHeaders())
    expect(onFirstUse).toHaveBeenCalledOnce()
  })

  describe('when nobody is watching', () => {
    let feed: Set<(message: FeedMessage) => void>
    const watch = (): { leave: () => void } => {
      const request = httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api/feed',
        headers: { host: `127.0.0.1:${port}`, authorization: `Bearer ${TOKEN}` }
      })
      request.on('error', () => undefined)
      request.end()
      return { leave: () => request.destroy() }
    }

    beforeEach(() => {
      feed = new Set()
      service.subscribe.mockImplementation((listener: (message: FeedMessage) => void) => {
        feed.add(listener)
        return () => {
          feed.delete(listener)
        }
      })
    })

    it('reports itself idle after the idle time with no page', async () => {
      await start({ idleMs: 40 })
      await vi.waitFor(() => expect(onIdle).toHaveBeenCalledOnce())
    })

    it('stays up while a page watches, and counts the idle time again once it leaves', async () => {
      await start({ idleMs: 40 })
      const page = watch()
      await vi.waitFor(() => expect(feed.size).toBe(1))
      await new Promise((resolve) => setTimeout(resolve, 120))
      expect(onIdle).not.toHaveBeenCalled()

      page.leave()
      await vi.waitFor(() => expect(onIdle).toHaveBeenCalledOnce())
    })

    it('ends open feeds when it closes, and stops counting idle time', async () => {
      await start({ idleMs: 40 })
      watch()
      await vi.waitFor(() => expect(feed.size).toBe(1))

      await server.close()
      await new Promise((resolve) => setTimeout(resolve, 120))

      expect(feed.size).toBe(0)
      expect(onIdle).not.toHaveBeenCalled()
    })
  })
})
