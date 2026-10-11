import { readdir, readFile, realpath } from 'fs/promises'
import { join } from 'path'
import { isMissing, object } from '../../bridge/io'

// Everything ClaudeWatch knows about who is signed in. These files sit beside credential
// stores, so nothing else in them is ever kept.
export interface Identity {
  accountUuid: string
  organizationUuid: string
  emailAddress: string
  organizationName: string
  organizationRateLimitTier: string | null
}

export type IdentityRead =
  | { status: 'signed-in'; identity: Identity }
  | { status: 'signed-out' }
  // Caught mid-write or not parseable: says nothing about who is signed in.
  | { status: 'unreadable' }

const MAX_VALUE_LENGTH = 256
const ACCOUNT_FOLDER = /^[\w-]{1,64}$/

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_VALUE_LENGTH ? value : null

function toIdentity(value: unknown): Identity | null {
  const account = object(value)
  const accountUuid = text(account?.accountUuid)
  const organizationUuid = text(account?.organizationUuid)
  const emailAddress = text(account?.emailAddress)
  if (!account || !accountUuid || !organizationUuid || !emailAddress) return null
  return {
    accountUuid,
    organizationUuid,
    emailAddress,
    organizationName: text(account.organizationName) ?? '',
    organizationRateLimitTier: text(account.organizationRateLimitTier)
  }
}

// `~/.claude.json` also holds MCP server secrets: the parsed file never leaves this function.
export async function readDefaultIdentity(home: string): Promise<IdentityRead> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'))
  } catch (error) {
    return { status: isMissing(error) ? 'signed-out' : 'unreadable' }
  }
  const identity = toIdentity(object(parsed)?.oauthAccount)
  return identity ? { status: 'signed-in', identity } : { status: 'signed-out' }
}

// Orca keeps one token-free identity file per account, beside files that do hold credentials.
// The path is built from fixed names, and a link leading anywhere else is not followed.
export async function readOrcaIdentities(orcaData: string): Promise<Identity[]> {
  let accounts: string
  let folders: string[]
  try {
    accounts = await realpath(join(orcaData, 'claude-accounts'))
    folders = await readdir(accounts)
  } catch {
    return []
  }
  const identities: Identity[] = []
  for (const folder of folders.filter((name) => ACCOUNT_FOLDER.test(name)).sort()) {
    const file = join(accounts, folder, 'auth', 'oauth-account.json')
    try {
      if ((await realpath(file)) !== file) continue
      const identity = toIdentity(JSON.parse(await readFile(file, 'utf8')))
      if (identity) identities.push(identity)
    } catch {
      // One unreadable account must not hide the others.
    }
  }
  return identities
}
