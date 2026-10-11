// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readDefaultIdentity, readOrcaIdentities } from './identity'

const CANARY = 'CANARY_SECRET_VALUE'
const oauthAccount = (name: string): Record<string, unknown> => ({
  accountUuid: `uuid-${name}`,
  organizationUuid: `org-${name}`,
  emailAddress: `${name}@example.test`,
  organizationName: `${name} Org`,
  organizationRateLimitTier: 'default_claude_max_20x',
  displayName: `Display ${CANARY}`,
  accessToken: CANARY,
  refreshToken: CANARY
})
const fiveKeys = (name: string): Record<string, unknown> => ({
  accountUuid: `uuid-${name}`,
  organizationUuid: `org-${name}`,
  emailAddress: `${name}@example.test`,
  organizationName: `${name} Org`,
  organizationRateLimitTier: 'default_claude_max_20x'
})

let home: string
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'cw-identity-'))
})
afterEach(() => rm(home, { recursive: true, force: true }))

describe('the default login', () => {
  const claudeJson = (content: unknown): Promise<void> =>
    writeFile(join(home, '.claude.json'), JSON.stringify(content))

  it('yields the five identity keys and nothing else in the file', async () => {
    await claudeJson({
      oauthAccount: oauthAccount('ada'),
      mcpServers: { linear: { env: { API_KEY: CANARY } } },
      projects: { '/repo': { mcpServers: { x: { headers: { Authorization: CANARY } } } } }
    })
    const read = await readDefaultIdentity(home)
    expect(read).toEqual({ status: 'signed-in', identity: fiveKeys('ada') })
    expect(JSON.stringify(read)).not.toContain(CANARY)
  })

  it('accepts an account with no plan tier', async () => {
    await claudeJson({ oauthAccount: { ...oauthAccount('ada'), organizationRateLimitTier: null } })
    expect(await readDefaultIdentity(home)).toMatchObject({
      identity: { organizationRateLimitTier: null }
    })
  })

  it.each([
    ['no file', undefined],
    ['no oauthAccount', { projects: {} }],
    ['an oauthAccount that is not an object', { oauthAccount: 'ada' }],
    ['no account id', { oauthAccount: { ...oauthAccount('ada'), accountUuid: undefined } }],
    ['no organisation id', { oauthAccount: { ...oauthAccount('ada'), organizationUuid: 7 } }],
    [
      'an over-long value',
      { oauthAccount: { ...oauthAccount('ada'), emailAddress: 'a'.repeat(400) } }
    ]
  ])('reads %s as signed out', async (_case, content) => {
    if (content) await claudeJson(content)
    expect(await readDefaultIdentity(home)).toEqual({ status: 'signed-out' })
  })

  it('reads a half-written file as unreadable, which is not the same as signed out', async () => {
    await writeFile(join(home, '.claude.json'), '{"oauthAccount":{"accountUuid":"uuid-a')
    expect(await readDefaultIdentity(home)).toEqual({ status: 'unreadable' })
  })
})

describe("Orca's account folders", () => {
  const accountFile = async (folder: string, content: unknown): Promise<string> => {
    const auth = join(home, 'claude-accounts', folder, 'auth')
    await mkdir(auth, { recursive: true })
    const file = join(auth, 'oauth-account.json')
    await writeFile(file, JSON.stringify(content))
    return file
  }

  it('reads the identity file of every account, five keys each', async () => {
    await accountFile('11111111-aaaa', oauthAccount('ada'))
    await accountFile('22222222-bbbb', oauthAccount('grace'))
    const identities = await readOrcaIdentities(home)
    expect(identities).toEqual([fiveKeys('ada'), fiveKeys('grace')])
    expect(JSON.stringify(identities)).not.toContain(CANARY)
  })

  it('opens no other file in the folder, whatever it is called', async () => {
    const file = await accountFile('11111111-aaaa', oauthAccount('ada'))
    const auth = join(file, '..')
    // Each is shaped like an identity, so reading any of them would add an account.
    for (const name of ['.orca-managed-claude-auth', 'system-default-auth.json', 'auth.json']) {
      await writeFile(join(auth, name), JSON.stringify(oauthAccount(CANARY)))
    }
    await writeFile(
      join(home, 'claude-accounts', 'system-default-auth.json'),
      JSON.stringify(oauthAccount(CANARY))
    )
    expect(await readOrcaIdentities(home)).toEqual([fiveKeys('ada')])
  })

  it('refuses an identity file, or an account folder, that is a link to somewhere else', async () => {
    const elsewhere = join(home, 'elsewhere')
    await mkdir(join(elsewhere, 'auth'), { recursive: true })
    const credentials = join(elsewhere, 'auth', 'oauth-account.json')
    await writeFile(credentials, JSON.stringify(oauthAccount('linked')))
    const auth = join(home, 'claude-accounts', '11111111-aaaa', 'auth')
    await mkdir(auth, { recursive: true })
    await symlink(credentials, join(auth, 'oauth-account.json'))
    await symlink(elsewhere, join(home, 'claude-accounts', '22222222-bbbb'))
    expect(await readOrcaIdentities(home)).toEqual([])
  })

  it('skips an account whose file is damaged and keeps the others', async () => {
    await accountFile('11111111-aaaa', oauthAccount('ada'))
    await writeFile(await accountFile('22222222-bbbb', {}), '{not json')
    await accountFile('33333333-cccc', { emailAddress: 'no-ids@example.test' })
    expect(await readOrcaIdentities(home)).toEqual([fiveKeys('ada')])
  })

  it('finds no accounts when Orca was never installed', async () => {
    expect(await readOrcaIdentities(join(home, 'missing'))).toEqual([])
  })
})
