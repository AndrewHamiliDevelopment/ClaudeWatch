import { join } from 'node:path'
import { accountKey } from './account-key'
import { type BridgeIo, isMissing, jsonObject, object } from './io'

export interface Rollout {
  path: string
  id: string
  cwd: string
  mtimeMs: number
  // When the thread was first created, however often it has been resumed since.
  startedAtMs: number | null
  // The account the session was created under, hashed here so its id never leaves this file.
  accountKey: string | null
}
interface CachedRollout {
  mtimeMs: number
  size: number
  rollout: Rollout | null
}
const caches = new WeakMap<BridgeIo, Map<string, Map<string, CachedRollout>>>()

export async function findRollouts(root: string, io: BridgeIo): Promise<Rollout[]> {
  let roots = caches.get(io)
  if (!roots) caches.set(io, (roots = new Map()))
  let cache = roots.get(root)
  if (!cache) roots.set(root, (cache = new Map()))
  const entries = cache
  const seen = new Set<string>()
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
        seen.add(path)
        const cached = entries.get(path)
        if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
          if (cached.rollout) rollouts.push(cached.rollout)
          continue
        }
        const header = jsonObject(await io.readFirstLine(path))
        const meta = object(header?.payload)
        let rollout: Rollout | null = null
        if (
          header?.type === 'session_meta' &&
          typeof meta?.cwd === 'string' &&
          typeof meta.id === 'string'
        ) {
          const creator = meta.creator_account_id
          const created = meta.timestamp ?? header.timestamp
          const startedAtMs = typeof created === 'string' ? Date.parse(created) : Number.NaN
          rollout = {
            path,
            id: meta.id,
            cwd: meta.cwd,
            mtimeMs: info.mtimeMs,
            startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : null,
            accountKey: typeof creator === 'string' && creator ? accountKey('codex', creator) : null
          }
          rollouts.push(rollout)
        }
        entries.set(path, { mtimeMs: info.mtimeMs, size: info.size, rollout })
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
  }
  await walk(join(root, 'sessions'))
  for (const path of entries.keys()) {
    if (!seen.has(path)) entries.delete(path)
  }
  return rollouts.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path))
}
