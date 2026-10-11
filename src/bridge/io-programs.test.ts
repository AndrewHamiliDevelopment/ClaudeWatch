import { beforeEach, expect, it, vi } from 'vitest'

const { execFile, assertOrcaTrusted } = vi.hoisted(() => ({
  execFile: vi.fn(),
  assertOrcaTrusted: vi.fn()
}))
vi.mock('node:child_process', () => ({ execFile }))
vi.mock('../shared/orca-bundle', async (original) => ({
  ...(await original<typeof import('../shared/orca-bundle')>()),
  assertOrcaTrusted
}))
import { ORCA_CLI } from '../shared/orca-bundle'
import { systemIo } from './io'
import { OrcaSource } from './orca'

beforeEach(() => {
  vi.resetAllMocks()
  execFile.mockImplementation((_file, _args, _options, done) => done(null, '{"ok":true}'))
  assertOrcaTrusted.mockResolvedValue(undefined)
})

it('runs Orca from the app bundle, the file the main process runs, and no other copy', async () => {
  expect(await systemIo.exec(ORCA_CLI, ['worktree', 'ps', '--json'])).toBe('{"ok":true}')
  expect(execFile.mock.calls[0].slice(0, 2)).toEqual([ORCA_CLI, ['worktree', 'ps', '--json']])
  await expect(systemIo.exec('/opt/homebrew/bin/orca', ['worktree', 'ps'])).rejects.toThrow(
    'forbidden'
  )
  expect(execFile).toHaveBeenCalledTimes(1)
})

it('has the Orca bundle checked before it runs anything from it, and only then', async () => {
  await systemIo.exec('/bin/ps', ['-o', 'lstart=', '-p', '1'])
  expect(assertOrcaTrusted).not.toHaveBeenCalled()

  await systemIo.exec(ORCA_CLI, ['worktree', 'ps', '--json'])
  expect(assertOrcaTrusted).toHaveBeenCalledOnce()
  expect(assertOrcaTrusted.mock.invocationCallOrder[0]).toBeLessThan(
    execFile.mock.invocationCallOrder[1]
  )
})

it('runs nothing from an Orca bundle whose signature does not hold, and says Orca is unavailable', async () => {
  assertOrcaTrusted.mockRejectedValue(new Error('code failed to satisfy specified requirement'))
  await expect(systemIo.exec(ORCA_CLI, ['worktree', 'ps', '--json'])).rejects.toThrow()

  const installed = { ...systemIo, stat: async () => ({ directory: false, mtimeMs: 0, size: 1 }) }
  expect(await new OrcaSource(installed).poll(0)).toEqual({
    id: 'orca',
    ok: false,
    detail: 'unavailable'
  })
  expect(execFile).not.toHaveBeenCalled()
})
