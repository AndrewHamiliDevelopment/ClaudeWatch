import { expect, it, vi } from 'vitest'

const execFile = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ execFile }))
import { ORCA_CLI, systemIo } from './io'

it('runs Orca from the app bundle, the file the main process runs, and no other copy', async () => {
  execFile.mockImplementation((_file, _args, _options, done) => done(null, '{"ok":true}'))
  expect(ORCA_CLI).toBe('/Applications/Orca.app/Contents/Resources/bin/orca')
  expect(await systemIo.exec(ORCA_CLI, ['worktree', 'ps', '--json'])).toBe('{"ok":true}')
  expect(execFile.mock.calls[0].slice(0, 2)).toEqual([ORCA_CLI, ['worktree', 'ps', '--json']])
  await expect(systemIo.exec('/opt/homebrew/bin/orca', ['worktree', 'ps'])).rejects.toThrow(
    'forbidden'
  )
  expect(execFile).toHaveBeenCalledTimes(1)
})
