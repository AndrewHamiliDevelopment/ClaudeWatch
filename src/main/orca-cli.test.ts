import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrcaCli, ORCA_APP, ORCA_CLI, ORCA_TEAM_ID } from './orca-cli'

const SIGNED_BY_ORCA = [
  'Executable=/Applications/Orca.app/Contents/MacOS/Orca',
  'Identifier=com.stablyai.orca',
  `TeamIdentifier=${ORCA_TEAM_ID}`
].join('\n')

describe('createOrcaCli', () => {
  const run = vi.fn()
  // What `codesign -dv` prints for the installed app; the tests change it to model a bad bundle.
  let described: string
  let sealIntact: boolean

  beforeEach(() => {
    vi.resetAllMocks()
    described = SIGNED_BY_ORCA
    sealIntact = true
    run.mockImplementation(async (bin: string, args: string[]) => {
      if (bin !== '/usr/bin/codesign') return { stdout: '{"ok":true}', stderr: '' }
      if (args[0] === '--verify' && !sealIntact) throw new Error('code object is not signed')
      return { stdout: '', stderr: args[0] === '-dv' ? described : '' }
    })
  })

  const programsRun = (): string[] => run.mock.calls.map(([bin]) => bin)

  it('runs the CLI inside the app bundle, not whatever orca is on PATH', () => {
    expect(ORCA_CLI).toBe('/Applications/Orca.app/Contents/Resources/bin/orca')
  })

  it('verifies the bundle seal and its team before the first command, with fixed arguments', async () => {
    const cli = createOrcaCli(run)

    expect(await cli.exec(['terminal', 'list', '--json'])).toBe('{"ok":true}')
    expect(run.mock.calls.map(([bin, args]) => [bin, args])).toEqual([
      ['/usr/bin/codesign', ['--verify', '--deep', '--strict', ORCA_APP]],
      ['/usr/bin/codesign', ['-dv', ORCA_APP]],
      [ORCA_CLI, ['terminal', 'list', '--json']]
    ])
  })

  it('verifies once for a burst of commands, and again after ten minutes', async () => {
    let now = 1_000
    const cli = createOrcaCli(run, () => now)
    await Promise.all([cli.exec(['status']), cli.exec(['terminal', 'list']), cli.raise()])
    await cli.exec(['status'])
    expect(programsRun().filter((bin) => bin === '/usr/bin/codesign')).toHaveLength(2)

    // Orca updates itself in place; a check from long ago says nothing about today's bundle.
    now += 10 * 60_000 + 1
    await cli.exec(['status'])
    expect(programsRun().filter((bin) => bin === '/usr/bin/codesign')).toHaveLength(4)
  })

  it('raises the bundle that was verified, not whichever app claims its bundle id', async () => {
    expect(await createOrcaCli(run).raise()).toBe(true)
    expect(run.mock.calls.at(-1)?.slice(0, 2)).toEqual(['/usr/bin/open', ['-a', ORCA_APP]])
  })

  it.each([
    ['the seal is broken', () => (sealIntact = false)],
    ['another team signed it', () => (described = 'TeamIdentifier=ABCDE12345')],
    [
      'the team only appears inside another value',
      () => (described = `Identifier=x.TeamIdentifier=${ORCA_TEAM_ID}`)
    ],
    ['it is not signed by a team', () => (described = 'TeamIdentifier=not set')]
  ])('executes nothing from Orca when %s', async (_case, tamper) => {
    tamper()
    const cli = createOrcaCli(run)

    await expect(cli.exec(['terminal', 'list', '--json'])).rejects.toThrow()
    expect(await cli.raise()).toBe(false)
    expect(programsRun().every((bin) => bin === '/usr/bin/codesign')).toBe(true)
  })

  it('checks again after a failure, so an Orca installed later starts working', async () => {
    sealIntact = false
    const cli = createOrcaCli(run)
    await expect(cli.exec(['status'])).rejects.toThrow()

    sealIntact = true
    expect(await cli.exec(['status'])).toBe('{"ok":true}')
  })

  it('reports a failed raise without throwing', async () => {
    run.mockImplementation(async (bin: string, args: string[]) => {
      if (bin === '/usr/bin/open') throw new Error('LSOpenURLsWithRole failed')
      return { stdout: '', stderr: args[0] === '-dv' ? SIGNED_BY_ORCA : '' }
    })
    expect(await createOrcaCli(run).raise()).toBe(false)
  })
})
