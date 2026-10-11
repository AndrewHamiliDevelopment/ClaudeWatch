import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface PlateProps {
  children: ReactNode
  className?: string
  faceClassName?: string
}

// The chamfer needs two elements: see `.plate` in globals.css.
export function Plate({ children, className, faceClassName }: PlateProps) {
  return (
    <div className={cn('plate', className)}>
      <div className={cn('plate-face', faceClassName)}>{children}</div>
    </div>
  )
}

export function Crest({ letters }: { letters: string }) {
  return (
    <span
      aria-hidden="true"
      className="crest inline-grid h-5 w-[22px] shrink-0 place-items-center bg-surface-hover pt-0.5 font-plate text-xs font-bold leading-none text-gold"
    >
      {letters}
    </span>
  )
}
