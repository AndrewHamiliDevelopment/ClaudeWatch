import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ORCA_APP, ORCA_CLI } from '../shared/orca-bundle'
import { createOrcaCli } from './orca-cli'

describe('createOrcaCli', () => {
  const run = vi.fn()
  const assertTrusted = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    run.mockResolvedValue({ stdout: '{"ok":true}', stderr: '' })
    assertTrusted.mockResolvedValue(undefined)
  })

  const programsRun = (): string[] => run.mock.calls.map(([bin]) => bin)

  it('has the bundle checked before each command, then runs it with fixed arguments', async () => {
    const cli = createOrcaCli(run, assertTrusted)

    expect(await cli.exec(['terminal', 'list', '--json'])).toBe('{"ok":true}')
    expect(assertTrusted.mock.invocationCallOrder[0]).toBeLessThan(run.mock.invocationCallOrder[0])
    expect(run.mock.calls.map(([bin, args]) => [bin, args])).toEqual([
      [ORCA_CLI, ['terminal', 'list', '--json']]
    ])

    await cli.exec(['status'])
    expect(assertTrusted).toHaveBeenCalledTimes(2)
  })

  it('raises the bundle that was verified, not whichever app claims its bundle id', async () => {
    expect(await createOrcaCli(run, assertTrusted).raise()).toBe(true)
    expect(assertTrusted).toHaveBeenCalledOnce()
    expect(run.mock.calls.at(-1)?.slice(0, 2)).toEqual(['/usr/bin/open', ['-a', ORCA_APP]])
  })

  it('executes nothing from Orca, and raises nothing, when the bundle is not trusted', async () => {
    assertTrusted.mockRejectedValue(new Error('code failed to satisfy specified requirement'))
    const cli = createOrcaCli(run, assertTrusted)

    await expect(cli.exec(['terminal', 'list', '--json'])).rejects.toThrow()
    expect(await cli.raise()).toBe(false)
    expect(programsRun()).toEqual([])
  })

  it('reports a failed raise without throwing', async () => {
    run.mockRejectedValue(new Error('LSOpenURLsWithRole failed'))
    expect(await createOrcaCli(run, assertTrusted).raise()).toBe(false)
  })
})
