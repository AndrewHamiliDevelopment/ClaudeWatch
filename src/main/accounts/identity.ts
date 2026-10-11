import { constants } from 'fs'
import { open, readdir, realpath } from 'fs/promises'
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
// `~/.claude.json` measured 228 KB on the owner's Mac; an Orca identity file is a few hundred bytes.
const MAX_LOGIN_FILE_BYTES = 8 * 1024 * 1024
const MAX_ORCA_IDENTITY_BYTES = 64 * 1024

interface FileStamp {
  size: number
  mtimeMs: number
}

// The text of a regular file under the cap, null for anything else at the path. Opened without
// blocking and checked on the open file, so a pipe or a huge file cannot stall the sampler.
// `text` is null when the file still carries the `known` stamp: it was not read again.
async function readSmallFile(
  path: string,
  maxBytes: number,
  known?: FileStamp | null
): Promise<(FileStamp & { text: string | null }) | null> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > maxBytes) return null
    const stamp = { size: info.size, mtimeMs: info.mtimeMs }
    if (known?.size === stamp.size && known.mtimeMs === stamp.mtimeMs) {
      return { ...stamp, text: null }
    }
    const buffer = Buffer.alloc(info.size)
    const { bytesRead } = await file.read(buffer, 0, info.size, 0)
    return { ...stamp, text: buffer.subarray(0, bytesRead).toString('utf8') }
  } finally {
    await file.close()
  }
}
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

// The last reading that parsed, with the stamp of the file it came from. The file is looked at
// every few seconds and rarely changes, and an unreadable reading is never kept.
let lastLogin: (FileStamp & { path: string; read: IdentityRead }) | null = null

// `~/.claude.json` also holds MCP server secrets: the parsed file never leaves this function.
export async function readDefaultIdentity(home: string): Promise<IdentityRead> {
  const path = join(home, '.claude.json')
  const known = lastLogin?.path === path ? lastLogin : null
  let parsed: unknown
  let stamp: FileStamp
  try {
    const file = await readSmallFile(path, MAX_LOGIN_FILE_BYTES, known)
    if (!file) return { status: 'unreadable' }
    if (known && file.text === null) return known.read
    parsed = JSON.parse(file.text ?? '')
    stamp = file
  } catch (error) {
    return { status: isMissing(error) ? 'signed-out' : 'unreadable' }
  }
  const identity = toIdentity(object(parsed)?.oauthAccount)
  const read: IdentityRead = identity ? { status: 'signed-in', identity } : { status: 'signed-out' }
  lastLogin = { path, size: stamp.size, mtimeMs: stamp.mtimeMs, read }
  return read
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
      const text = (await readSmallFile(file, MAX_ORCA_IDENTITY_BYTES))?.text
      const identity = text ? toIdentity(JSON.parse(text)) : null
      if (identity) identities.push(identity)
    } catch {
      // One unreadable account must not hide the others.
    }
  }
  return identities
}
