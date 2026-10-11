import { expect, it, vi } from 'vitest'
import { findRollouts } from './codex-rollouts'
import { fixtureIo } from './__fixtures__/helpers'

it('caches headers by path, mtime and size and prunes deleted files', async () => {
  const path = '/codex/sessions/rollout-a.jsonl'
  const files: Record<string, string | null> = {
    [path]: JSON.stringify({ type: 'session_meta', payload: { id: 'a', cwd: '/repo' } })
  }
  const io = fixtureIo(files)
  const stat = io.stat
  let mtimeMs = 1000
  let size = 100
  io.stat = async (candidate) =>
    candidate === path ? { directory: false, mtimeMs, size } : stat(candidate)
  const header = vi.spyOn(io, 'readFirstLine')
  await findRollouts('/codex', io)
  await findRollouts('/codex', io)
  expect(header).toHaveBeenCalledTimes(1)
  mtimeMs++
  await findRollouts('/codex', io)
  expect(header).toHaveBeenCalledTimes(2)
  size++
  await findRollouts('/codex', io)
  expect(header).toHaveBeenCalledTimes(3)
  delete files[path]
  expect(await findRollouts('/codex', io)).toEqual([])
  files[path] = JSON.stringify({ type: 'session_meta', payload: { id: 'b', cwd: '/new' } })
  expect((await findRollouts('/codex', io))[0].id).toBe('b')
  expect(header).toHaveBeenCalledTimes(4)
})
