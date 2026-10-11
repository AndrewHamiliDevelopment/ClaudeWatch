import { beforeEach, describe, expect, it, vi } from 'vitest'

const execFile = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ execFile }))

import { createOrcaTrust, ORCA_APP, ORCA_CLI, ORCA_TEAM_ID, ORCA_TRUST_MS } from './orca-bundle'

type Done = (error: Error | null) => void

describe('the Orca bundle check', () => {
  let isSigned: boolean

  beforeEach(() => {
    execFile.mockReset()
    isSigned = true
    execFile.mockImplementation((_file: string, _args: string[], _options: object, done: Done) =>
      done(isSigned ? null : new Error('code failed to satisfy specified code requirement(s)'))
    )
  })

  it('names the CLI inside the app bundle, not whatever orca is on PATH', () => {
    expect(ORCA_CLI).toBe('/Applications/Orca.app/Contents/Resources/bin/orca')
  })

  it('checks the seal and the signer in one codesign call, with a requirement anchored at Apple', async () => {
    await createOrcaTrust()()

    expect(execFile).toHaveBeenCalledOnce()
    const [program, args] = execFile.mock.calls[0]
    expect(program).toBe('/usr/bin/codesign')
    expect(args).toEqual([
      '--verify',
      '--deep',
      '--strict',
      `-R=anchor apple generic and certificate leaf[subject.OU] = "${ORCA_TEAM_ID}" and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists`,
      ORCA_APP
    ])
  })

  it('never reads a signature description, whose lines the bundle itself can write', async () => {
    await createOrcaTrust()()
    expect(execFile.mock.calls.flatMap(([, args]) => args)).not.toContain('-dv')
  })

  it('rejects when codesign does, and checks again next time', async () => {
    isSigned = false
    const assertTrusted = createOrcaTrust()
    await expect(assertTrusted()).rejects.toThrow()

    isSigned = true
    await expect(assertTrusted()).resolves.toBeUndefined()
    expect(execFile).toHaveBeenCalledTimes(2)
  })

  it('verifies once for a burst of calls, and again a few seconds later', async () => {
    let now = 1_000
    const assertTrusted = createOrcaTrust(() => now)
    await Promise.all([assertTrusted(), assertTrusted(), assertTrusted()])
    now += ORCA_TRUST_MS
    await assertTrusted()
    expect(execFile).toHaveBeenCalledOnce()

    now += 1
    await assertTrusted()
    expect(execFile).toHaveBeenCalledTimes(2)
  })

  it('trusts a passed check for seconds, not minutes', () => {
    expect(ORCA_TRUST_MS).toBeLessThanOrEqual(5_000)
  })
})
