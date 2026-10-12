// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { execFilePromise, assertOrcaTrusted } = vi.hoisted(() => ({
  execFilePromise: vi.fn(),
  assertOrcaTrusted: vi.fn()
}))
vi.mock('../platform/exec', () => ({ execFilePromise }))
vi.mock('../../shared/orca-bundle', async (original) => ({
  ...(await original<typeof import('../../shared/orca-bundle')>()),
  assertOrcaTrusted
}))

import { ORCA_CLI } from '../../shared/orca-bundle'
import { createAccountLedger } from './index'

const CANARY = 'CANARY_SECRET_VALUE'
const oauthAccount = (name: string): Record<string, unknown> => ({
  accountUuid: `uuid-${name}`,
  organizationUuid: `org-${name}`,
  emailAddress: `${name}@example.test`,
  organizationName: `${name} Labs`,
  organizationRateLimitTier: 'max',
  accessToken: CANARY
})

let home: string
let userData: string
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'cw-home-'))
  userData = await mkdtemp(join(tmpdir(), 'cw-userdata-'))
  await writeFile(
    join(home, '.claude.json'),
    JSON.stringify({ oauthAccount: oauthAccount('ada'), mcpServers: { x: { env: { K: CANARY } } } })
  )
  const auth = join(home, 'Library', 'Application Support', 'orca', 'claude-accounts', 'a1', 'auth')
  await mkdir(auth, { recursive: true })
  await writeFile(join(auth, 'oauth-account.json'), JSON.stringify(oauthAccount('grace')))
  await writeFile(join(auth, '.orca-managed-claude-auth'), CANARY)
  execFilePromise.mockReset()
  assertOrcaTrusted.mockReset()
  assertOrcaTrusted.mockResolvedValue(undefined)
  execFilePromise.mockImplementation(async (program: string) => ({
    stdout:
      program === ORCA_CLI
        ? JSON.stringify({ ok: true, result: { claude: { accounts: [] }, token: CANARY } })
        : '',
    stderr: ''
  }))
})
afterEach(async () => {
  await rm(home, { recursive: true, force: true })
  await rm(userData, { recursive: true, force: true })
})

const everyFile = async (folder: string): Promise<string[]> =>
  (await readdir(folder, { recursive: true })).sort()

it('watches the real files with one fixed, scrubbed Orca command, and keeps its ledger private', async () => {
  const before = await everyFile(home)
  const ledger = createAccountLedger({ isWatching: true, home, userData })
  ledger.start()
  await vi.waitFor(() => expect(execFilePromise).toHaveBeenCalledTimes(1))
  await vi.waitFor(async () =>
    expect(await ledger.dashboardState()).toMatchObject({
      status: 'on',
      accounts: [{ email: 'ada@example.test', isActive: true }, { email: 'grace@example.test' }]
    })
  )
  ledger.stop()

  const scrubbed = { timeout: 15_000, env: { LC_ALL: 'C', TZ: 'UTC' } }
  // The bundle check is the one the whole process shares, not a second one of the ledger's.
  expect(assertOrcaTrusted).toHaveBeenCalledOnce()
  expect(execFilePromise.mock.calls).toEqual([[ORCA_CLI, ['account', 'list', '--json'], scrubbed]])
  const file = join(userData, 'accounts-ledger.json')
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect(await readFile(file, 'utf8')).not.toContain(CANARY)
  expect(await readFile(file, 'utf8')).not.toMatch(/uuid-ada|uuid-grace/)
  // Nothing is ever written beside the files it reads.
  expect(await everyFile(home)).toEqual(before)
})

it('touches no file and runs no program while accounts are not watched', async () => {
  const ledger = createAccountLedger({ isWatching: false, home, userData })
  ledger.start()
  expect(await ledger.dashboardState()).toEqual({ status: 'off' })
  ledger.stop()
  expect(execFilePromise).not.toHaveBeenCalled()
  expect(await readdir(userData)).toEqual([])
})
