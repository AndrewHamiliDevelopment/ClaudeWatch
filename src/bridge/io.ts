import { execFile } from 'node:child_process'
import { open, readFile, readdir, realpath, stat } from 'node:fs/promises'

interface FileInfo {
  directory: boolean
  mtimeMs: number
  size: number
}
// Whole lines only: `text` ends at the last newline read, and `nextOffset` is where to resume.
interface ForwardRead {
  text: string
  nextOffset: number
}
export interface BridgeIo {
  readText(path: string): Promise<string>
  readTail(path: string): Promise<string>
  readFirstLine(path: string): Promise<string>
  readFrom(path: string, offset: number, maxBytes: number): Promise<ForwardRead>
  list(path: string): Promise<string[]>
  stat(path: string): Promise<FileInfo>
  exec(file: string, args: string[]): Promise<string>
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function readTail(path: string): Promise<string> {
  const file = await open(path, 'r')
  try {
    const { size } = await file.stat()
    const start = Math.max(0, size - 65536)
    const buffer = Buffer.alloc(Math.min(size, 65536))
    const { bytesRead } = await file.read(buffer, 0, buffer.length, start)
    const text = buffer.subarray(0, bytesRead).toString('utf8')
    // A partial first JSON record cannot safely be interpreted.
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text
  } finally {
    await file.close()
  }
}

async function readFirstLine(path: string): Promise<string> {
  const file = await open(path, 'r')
  try {
    const cap = 256 * 1024
    const chunks: Buffer[] = []
    let offset = 0
    while (offset <= cap) {
      const buffer = Buffer.alloc(Math.min(16384, cap + 1 - offset))
      const { bytesRead } = await file.read(buffer, 0, buffer.length, offset)
      if (!bytesRead) return Buffer.concat(chunks).toString('utf8')
      const chunk = buffer.subarray(0, bytesRead)
      const newline = chunk.indexOf(10)
      if (newline >= 0) {
        chunks.push(chunk.subarray(0, newline))
        return Buffer.concat(chunks).toString('utf8')
      }
      offset += bytesRead
      if (offset > cap) return ''
      chunks.push(chunk)
    }
    return ''
  } finally {
    await file.close()
  }
}

async function readFrom(path: string, offset: number, maxBytes: number): Promise<ForwardRead> {
  const file = await open(path, 'r')
  try {
    const { size } = await file.stat()
    const buffer = Buffer.alloc(Math.max(0, Math.min(maxBytes, size - offset)))
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset)
    // Byte 10 never occurs inside a multi-byte UTF-8 character, so the cut is always clean.
    const end = buffer.subarray(0, bytesRead).lastIndexOf(10) + 1
    return { text: buffer.subarray(0, end).toString('utf8'), nextOffset: offset + end }
  } finally {
    await file.close()
  }
}

// Enforced here, at the only door to the disk and to subprocesses, so no source can
// reach a credential store or a shell by mistake.
const CREDENTIAL_STORE = /(^|\/)(\.credentials\.json|auth\.json|orca-runtime\.json)$|\.key$/i
// The app-bundle copy, which the main process runs too; Homebrew's is only a symlink to it.
export const ORCA_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const PROGRAMS = new Set(['/bin/ps', '/usr/sbin/lsof', ORCA_CLI])
const forbidden = (what: string): Error => new Error(`forbidden: ${what}`)
const guarded =
  <Rest extends unknown[], Result>(read: (path: string, ...rest: Rest) => Promise<Result>) =>
  async (path: string, ...rest: Rest): Promise<Result> => {
    if (CREDENTIAL_STORE.test(path)) throw forbidden('credential store')
    // The file a symlink points at is checked too, and that resolved file is the one opened.
    const target = await realpath(path)
    if (CREDENTIAL_STORE.test(target)) throw forbidden('credential store')
    return read(target, ...rest)
  }

export const systemIo: BridgeIo = {
  readText: guarded((path) => readFile(path, 'utf8')),
  readTail: guarded(readTail),
  readFirstLine: guarded(readFirstLine),
  readFrom: guarded(readFrom),
  list: (path) => readdir(path),
  stat: async (path) => {
    const info = await stat(path)
    return { directory: info.isDirectory(), mtimeMs: info.mtimeMs, size: info.size }
  },
  exec: (file, args) =>
    new Promise((resolve, reject) => {
      if (!PROGRAMS.has(file)) return reject(forbidden('program'))
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
