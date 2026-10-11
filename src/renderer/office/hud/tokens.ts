import { sumCounts } from '../../../shared/office/token-counts'
import type { SessionUsage, SubagentRef } from '../../../shared/office/types'
import { formatTokens, formatTotal } from '../../deck/tokens'

const COUNTING_TEXT = 'counting…'

// Unknown is never 0: the bridge sends null until a transcript has been read.
export function tokensText(tokens: number | null, isPartial = false): string {
  return tokens === null ? COUNTING_TEXT : formatTotal(tokens, isPartial)
}

export function memberTokens(member: Pick<SubagentRef, 'tokens'>): number | null {
  return member.tokens ? sumCounts(member.tokens) : null
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
