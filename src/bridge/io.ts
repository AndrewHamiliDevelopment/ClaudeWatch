import { execFile } from 'node:child_process'
import { open, readFile, readdir, stat } from 'node:fs/promises'

export interface FileInfo {
  directory: boolean
  mtimeMs: number
}
export interface BridgeIo {
  readText(path: string): Promise<string>
  readTail(path: string): Promise<string>
  readFirstLine(path: string): Promise<string>
  list(path: string): Promise<string[]>
  stat(path: string): Promise<FileInfo>
  exec(file: string, args: string[]): Promise<string>
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function readPart(path: string, tail: boolean): Promise<string> {
  const file = await open(path, 'r')
  try {
    const { size } = await file.stat()
    const start = tail ? Math.max(0, size - 65536) : 0
    const buffer = Buffer.alloc(Math.min(size, 65536))
    const { bytesRead } = await file.read(buffer, 0, buffer.length, start)
    const text = buffer.subarray(0, bytesRead).toString('utf8')
    // A partial first JSON record cannot safely be interpreted.
    return tail && start > 0 ? text.slice(text.indexOf('\n') + 1) : text
  } finally {
    await file.close()
  }
}

export const systemIo: BridgeIo = {
  readText: (path) => readFile(path, 'utf8'),
  readTail: (path) => readPart(path, true),
  readFirstLine: async (path) => (await readPart(path, false)).split('\n')[0],
  list: (path) => readdir(path),
  stat: async (path) => {
    const info = await stat(path)
    return { directory: info.isDirectory(), mtimeMs: info.mtimeMs }
  },
  exec: (file, args) =>
    new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        { env: { LC_ALL: 'C', TZ: 'UTC' }, timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout)
        }
      )
    })
}

export function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function jsonObject(text: string): Record<string, unknown> | null {
  try {
    return object(JSON.parse(text))
  } catch {
    return null
  }
}
