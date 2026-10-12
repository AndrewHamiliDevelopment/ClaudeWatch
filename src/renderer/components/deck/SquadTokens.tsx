import type { Squad } from '../../deck/roster'
import { formatTotal } from '../../deck/tokens'
import { cn } from '../../lib/utils'

interface SquadTokensProps {
  squad: Pick<Squad, 'tokens' | 'isTokensPartial'>
  className: string
}

// A squad's token total; nothing until one of its sessions has been counted.
export function SquadTokens({ squad, className }: SquadTokensProps) {
  if (squad.tokens === null) return null
  return (
    <span className={cn('text-right tabular-nums text-accent', className)}>
      {formatTotal(squad.tokens, squad.isTokensPartial)}
      <span className="sr-only">{squad.isTokensPartial ? ' or more tokens' : ' tokens'}</span>
    </span>
  )
}
