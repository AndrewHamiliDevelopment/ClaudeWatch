import type {
  SessionRef,
  SessionUsage,
  SubagentRef,
  TokenCounts
} from '../../../shared/office/types'
import { sessionTokens, sumCounts } from '../../deck/roster'
import { formatCompactNumber } from '../../lib/utils'

const BILLION = 1_000_000_000
const COUNTING_TEXT = 'counting…'

// One decimal hides 50M at this size, so billions keep two.
export function formatTokens(tokens: number): string {
  return tokens < BILLION ? formatCompactNumber(tokens) : `${(tokens / BILLION).toFixed(2)}B`
}

// Unknown is never 0: the bridge sends null until a transcript has been read.
export function tokensText(tokens: number | null): string {
  return tokens === null ? COUNTING_TEXT : formatTokens(tokens)
}

export function memberTokens(member: Pick<SubagentRef, 'tokens'>): number | null {
  return member.tokens ? sumCounts(member.tokens) : null
}

export function usageParts(usage: Pick<SessionUsage, 'own' | 'subagents'>): TokenCounts {
  return {
    input: usage.own.input + usage.subagents.input,
    output: usage.own.output + usage.subagents.output,
    cacheWrite: usage.own.cacheWrite + usage.subagents.cacheWrite,
    cacheRead: usage.own.cacheRead + usage.subagents.cacheRead
  }
}

type ContextWindow = Pick<SessionUsage, 'contextTokens' | 'contextLimit'>

export function contextShare(usage: ContextWindow): number | null {
  if (usage.contextTokens === null || !usage.contextLimit) return null
  return (usage.contextTokens / usage.contextLimit) * 100
}

export function contextText(usage: ContextWindow): string | null {
  if (usage.contextTokens === null) return null
  const share = contextShare(usage)
  const tokens = formatTokens(usage.contextTokens)
  if (share === null || !usage.contextLimit) return tokens
  return `${tokens} of ${formatTokens(usage.contextLimit)}, ${Math.round(share)}%`
}

// A key is present only once one of its sessions has been counted, so a row can stay blank.
export interface TokenLedger {
  office: number | null
  companies: ReadonlyMap<string, number>
  projects: ReadonlyMap<string, number>
}

export function buildTokenLedger(sessions: readonly SessionRef[]): TokenLedger {
  const companies = new Map<string, number>()
  const projects = new Map<string, number>()
  let office: number | null = null
  for (const session of sessions) {
    const tokens = sessionTokens(session.usage)
    if (tokens === null) continue
    office = (office ?? 0) + tokens
    companies.set(session.companyKey, (companies.get(session.companyKey) ?? 0) + tokens)
    projects.set(session.projectKey, (projects.get(session.projectKey) ?? 0) + tokens)
  }
  return { office, companies, projects }
}
