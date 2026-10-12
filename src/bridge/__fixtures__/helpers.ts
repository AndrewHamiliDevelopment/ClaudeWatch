import type { BridgeIo } from '../io'
import { OpencodeDbError } from '../opencode-db'
import type { RegistryEntry } from '../registry'
import type { SessionRef } from '../../shared/office/types'

export function missing(): Error {
  return Object.assign(new Error('missing'), { code: 'ENOENT' })
}
export function fixtureIo(files: Record<string, string | null> = {}): BridgeIo {
  const read = async (path: string): Promise<string> => {
    if (typeof files[path] !== 'string') throw missing()
    return files[path]
  }
  return {
    readText: read,
    readTail: read,
    readFirstLine: async (path) => (await read(path)).split('\n')[0],
    readFrom: async (path, offset, maxBytes) => {
      const window = Buffer.from(await read(path)).subarray(offset, offset + maxBytes)
      const end = window.lastIndexOf(10) + 1
      return { text: window.subarray(0, end).toString('utf8'), nextOffset: offset + end }
    },
    list: async (path) => {
      const children = Object.keys(files)
        .filter((file) => file.startsWith(`${path}/`))
        .map((file) => file.slice(path.length + 1).split('/')[0])
      if (!children.length) throw missing()
      return [...new Set(children)]
    },
    stat: async (path) => {
      if (!(path in files)) {
        if (Object.keys(files).some((file) => file.startsWith(`${path}/`)))
          return { directory: true, mtimeMs: 1000, size: 0 }
        throw missing()
      }
      return {
        directory: files[path] === null,
        mtimeMs: 1000,
        size: Buffer.byteLength(files[path] ?? '')
      }
    },
    exec: async () => '',
    readOpencode: async () => {
      throw new OpencodeDbError('missing')
    }
  }
}
export function registryEntry(): RegistryEntry {
  return {
    pid: 42,
    sessionId: 'a',
    cwd: '/repo',
    name: '',
    status: 'busy',
    waitingFor: '',
    procStart: 'Sat Oct 10 15:29:12 2026',
    updatedAtMs: 1000
  }
}
export function session(id: string): SessionRef {
  return {
    key: `claude:${id}`,
    provider: 'claude',
    sessionId: id,
    pid: 42,
    name: id,
    cwd: '/repo',
    projectKey: 'p_repo',
    projectLabel: 'repo',
    projectRoot: '/repo/app',
    companyKey: 'c_test',
    companyLabel: 'Test Co',
    worktree: null,
    host: 'terminal',
    orcaPaneKey: null,
    activity: 'idle',
    attention: 'none',
    currentTool: null,
    subagents: [],
    startedAtMs: 0,
    updatedAtMs: 1000
  }
}
