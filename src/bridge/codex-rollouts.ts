import { join } from 'node:path'
import { type BridgeIo, isMissing, jsonObject, object } from './io'

export interface Rollout {
  path: string
  id: string
  cwd: string
  mtimeMs: number
}
export async function findRollouts(root: string, io: BridgeIo): Promise<Rollout[]> {
  const rollouts: Rollout[] = []
  async function walk(directory: string): Promise<void> {
    let files: string[]
    try {
      files = await io.list(directory)
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }
    for (const file of files) {
      const path = join(directory, file)
      try {
        const info = await io.stat(path)
        if (info.directory) {
          await walk(path)
          continue
        }
        if (!/^rollout-.*\.jsonl$/.test(file)) continue
        const header = jsonObject(await io.readFirstLine(path))
        const meta = object(header?.payload)
        if (
          header?.type === 'session_meta' &&
          typeof meta?.cwd === 'string' &&
          typeof meta.id === 'string'
        ) {
          rollouts.push({ path, id: meta.id, cwd: meta.cwd, mtimeMs: info.mtimeMs })
        }
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
  }
  await walk(join(root, 'sessions'))
  return rollouts.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path))
}
