import { sumCounts } from '../../shared/office/token-counts'
import type { SessionRef, SessionUsage } from '../../shared/office/types'
import { formatCompactNumber } from '../lib/utils'

const BILLION = 1_000_000_000

export function sessionTokens(usage: SessionUsage | null | undefined): number | null {
  if (!usage) return null
  return sumCounts(usage.own) + sumCounts(usage.subagents)
}

// One decimal hides 50M at this size, so billions keep two.
export function formatTokens(tokens: number): string {
  return tokens < BILLION ? formatCompactNumber(tokens) : `${(tokens / BILLION).toFixed(2)}B`
}

// A total with a session still uncounted is a floor, and reads as one: "1.05B+".
export function formatTotal(tokens: number, isPartial: boolean): string {
  return isPartial ? `${formatTokens(tokens)}+` : formatTokens(tokens)
}

// A key is present only once one of its sessions has been counted, so a row can stay blank.
export interface TokenLedger {
  office: number | null
  companies: ReadonlyMap<string, number>
  projects: ReadonlyMap<string, number>
  // Where a session is still being counted, so the total above it is not final.
  isOfficePartial: boolean
  partialCompanies: ReadonlySet<string>
  partialProjects: ReadonlySet<string>
}

// The one roll-up of session tokens, shared by the dashboard and the Office.
export function buildTokenLedger(sessions: readonly SessionRef[]): TokenLedger {
  const companies = new Map<string, number>()
  const projects = new Map<string, number>()
  const partialCompanies = new Set<string>()
  const partialProjects = new Set<string>()
  let office: number | null = null
  for (const session of sessions) {
    const tokens = sessionTokens(session.usage)
    if (tokens === null) {
      partialCompanies.add(session.companyKey)
      partialProjects.add(session.projectKey)
      continue
    }
    office = (office ?? 0) + tokens
    companies.set(session.companyKey, (companies.get(session.companyKey) ?? 0) + tokens)
    projects.set(session.projectKey, (projects.get(session.projectKey) ?? 0) + tokens)
  }
  return {
    office,
    companies,
    projects,
    isOfficePartial: partialProjects.size > 0,
    partialCompanies,
    partialProjects
  }
}
