import type { SessionUsage, SubagentRef, TokenCounts } from '../../../shared/office/types'
import { formatTokens, formatTotal, sumCounts } from '../../deck/tokens'

const COUNTING_TEXT = 'counting…'

// Unknown is never 0: the bridge sends null until a transcript has been read.
export function tokensText(tokens: number | null, isPartial = false): string {
  return tokens === null ? COUNTING_TEXT : formatTotal(tokens, isPartial)
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
