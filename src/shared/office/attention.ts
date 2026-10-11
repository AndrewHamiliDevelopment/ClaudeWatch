import type { AgentAttention } from './types'

// The two states in which an agent is blocked until its human answers.
export const NEEDS_HUMAN = ['permission', 'question'] as const

export type HumanAttention = (typeof NEEDS_HUMAN)[number]

export function needsHuman(attention: AgentAttention | undefined): attention is HumanAttention {
  return NEEDS_HUMAN.some((waiting) => waiting === attention)
}
