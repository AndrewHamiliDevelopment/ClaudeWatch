import { expect, it, vi } from 'vitest'
import { transcriptPath } from './transcript-tail'
import { fixtureIo } from './__fixtures__/helpers'

it('encodes all non-alphanumeric cwd characters without scanning projects', async () => {
  const path = '/claude/projects/-repo-my-project--a-/session.jsonl'
  const io = fixtureIo({ [path]: '' })
  const list = vi.spyOn(io, 'list')
  expect(await transcriptPath('/claude', '/repo/my_project (a)', 'session', io)).toBe(path)
  expect(list).not.toHaveBeenCalled()
})
it('caches fallback paths per root, cwd and session without caching misses', async () => {
  const path = '/claude/projects/legacy/session.jsonl'
  const files: Record<string, string | null> = { [path]: '' }
  const io = fixtureIo(files)
  const stat = vi.spyOn(io, 'stat')
  expect(await transcriptPath('/claude', '/repo', 'session', io)).toBe(path)
  const reads = stat.mock.calls.length
  expect(await transcriptPath('/claude', '/repo', 'session', io)).toBe(path)
  expect(stat).toHaveBeenCalledTimes(reads)
  expect(await transcriptPath('/claude', '/repo', 'new', io)).toBeNull()
  files['/claude/projects/-repo/new.jsonl'] = ''
  expect(await transcriptPath('/claude', '/repo', 'new', io)).toBe(
    '/claude/projects/-repo/new.jsonl'
  )
})
