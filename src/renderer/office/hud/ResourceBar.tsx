import { Bot, Gauge } from 'lucide-react'
import { Plate } from '../../components/deck/Plate'
import { cn } from '../../lib/utils'
import { COUNT_CLASS } from './hud-styles'
import { tokensText } from './tokens'

interface ResourceBarProps {
  agentCount: number
  // Null until a session has been counted.
  tokens: number | null
  // A session is still being counted, so the total is a floor.
  isPartial: boolean
}

// The office at a glance. Tokens are what live sessions have spent since they began.
export function ResourceBar({ agentCount, tokens, isPartial }: ResourceBarProps) {
  return (
    <section aria-label="Office totals">
      <Plate faceClassName="flex h-[42px] items-center gap-4 px-4 text-xs text-text-secondary">
        <p className="flex items-center gap-1.5">
          <Bot aria-hidden="true" className="size-4" />
          <span>
            <strong className={cn(COUNT_CLASS, 'text-text-primary')}>{agentCount}</strong>{' '}
            {agentCount === 1 ? 'agent' : 'agents'}
          </span>
        </p>
        <p className="flex items-center gap-1.5 border-l border-border pl-4">
          <Gauge aria-hidden="true" className="size-4 text-accent" />
          {tokens === null ? (
            <span>Tokens: {tokensText(tokens)}</span>
          ) : (
            <span>
              <strong className={cn(COUNT_CLASS, 'text-accent')}>
                {tokensText(tokens, isPartial)}
              </strong>{' '}
              tokens
            </span>
          )}
        </p>
      </Plate>
    </section>
  )
}
