import { jsonObject, object } from '../../bridge/io'
import type { AccountLimit } from '../../shared/accounts'
import type { OrcaExec } from '../orca-terminals'

interface OrcaAccountRow {
  id: string
  email: string
  organizationUuid: string
  organizationName: string
}

export interface OrcaAccountList {
  claude: OrcaAccountRow[]
  // Orca's last readings: the signed-in account first, then the others it has cached.
  claudeLimits: { orcaAccountId: string; limits: AccountLimit[] }[]
  codex: {
    providerAccountId: string
    email: string | null
    workspaceLabel: string | null
    limits: AccountLimit[]
  } | null
}

const MAX_VALUE_LENGTH = 256
// A window under any other name covers one model family, and that name is its scope.
const UNSCOPED_WINDOWS = new Set(['session', 'weekly'])

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_VALUE_LENGTH ? value : null
const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

function toLimits(reading: Record<string, unknown> | null): AccountLimit[] {
  const fetchedAtMs = amount(reading?.updatedAt)
  if (!reading || fetchedAtMs === null) return []
  return Object.entries(reading).flatMap(([name, value]): AccountLimit[] => {
    const window = object(value)
    const usedPercent = amount(window?.usedPercent)
    const windowMinutes = amount(window?.windowMinutes)
    if (!window || usedPercent === null || !windowMinutes) return []
    return [
      {
        windowMinutes,
        scope: UNSCOPED_WINDOWS.has(name) ? null : name,
        usedPercent,
        resetsAtMs: amount(window.resetsAt),
        source: 'orca-cache',
        fetchedAtMs
      }
    ]
  })
}

function toRow(value: unknown): OrcaAccountRow[] {
  const account = object(value)
  const id = text(account?.id)
  const email = text(account?.email)
  const organizationUuid = text(account?.organizationUuid)
  if (!account || !id || !email || !organizationUuid) return []
  return [{ id, email, organizationUuid, organizationName: text(account.organizationName) ?? '' }]
}

// Rebuilt key by key from what is named here, so nothing else Orca sends can be kept.
export function parseOrcaAccountList(stdout: string): OrcaAccountList | null {
  const response = jsonObject(stdout)
  const result = object(response?.result)
  if (response?.ok !== true || !result) return null
  const claude = object(result.claude)
  const rateLimits = object(result.rateLimits)
  const rows = Array.isArray(claude?.accounts) ? claude.accounts.flatMap(toRow) : []
  const activeId = text(claude?.activeAccountId)
  const cached = Array.isArray(rateLimits?.inactiveClaudeAccounts)
    ? rateLimits.inactiveClaudeAccounts
    : []
  const login = object(object(result.codex)?.systemDefault)
  const providerAccountId = text(login?.providerAccountId)
  return {
    claude: rows,
    claudeLimits: [
      ...(activeId
        ? [{ orcaAccountId: activeId, limits: toLimits(object(rateLimits?.claude)) }]
        : []),
      ...cached.flatMap((value) => {
        const entry = object(value)
        const orcaAccountId = text(entry?.accountId)
        return orcaAccountId ? [{ orcaAccountId, limits: toLimits(object(entry?.rateLimits)) }] : []
      })
    ],
    codex:
      login?.hasAuth === true && providerAccountId
        ? {
            providerAccountId,
            email: text(login.email),
            workspaceLabel: text(login.workspaceLabel),
            limits: toLimits(object(rateLimits?.codex))
          }
        : null
  }
}

// `account add`, `select` and `rm` change who is signed in; this is the only command sent.
export async function listOrcaAccounts(exec: OrcaExec): Promise<OrcaAccountList | null> {
  try {
    return parseOrcaAccountList(await exec(['account', 'list', '--json']))
  } catch {
    return null
  }
}
