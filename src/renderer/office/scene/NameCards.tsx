import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import { cn } from '../../lib/utils'
import type { ZoomBand } from '../logic/camera-bands'
import type { NameCard } from '../logic/name-cards'
import { CARD_STATUS_COLOR } from '../office-palette'

const CARD_HEIGHT = 1.95
const PILL_HEIGHT = 1.15
const OFFSCREEN = 'translate(-9999px, -9999px)'

export type CardAnchors = Map<string, HTMLElement>

// Runs inside the Canvas: projects each card's 3D anchor to screen space and moves its DOM node.
// One DOM layer instead of drei <Html> avoids a React root per card (and its unmount races).
export function CardProjector({
  cards,
  anchors
}: {
  cards: readonly NameCard[]
  anchors: CardAnchors
}) {
  const point = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const card of cards) {
      const element = anchors.get(card.agentKey)
      if (!element) continue
      point.set(card.x, card.kind === 'card' ? CARD_HEIGHT : PILL_HEIGHT, card.z).project(camera)
      const isVisible = point.z < 1 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1
      const left = ((point.x + 1) / 2) * size.width
      const top = ((1 - point.y) / 2) * size.height
      element.style.transform = isVisible
        ? `translate(${left}px, ${top}px) translate(-50%, -100%)`
        : OFFSCREEN
    }
  })
  return null
}

function StatusDot({ card }: { card: NameCard }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full ring-1 ring-black/40"
      style={{ backgroundColor: CARD_STATUS_COLOR[card.status] }}
    />
  )
}

// White desk cards (status dot, NAME, role line) and apprentice pills. They repeat what the
// List view and inspector expose, so the layer stays out of the accessibility tree.
export function NameCardLayer(props: {
  cards: readonly NameCard[]
  band: ZoomBand
  selectedAgentKey: string | null
  anchors: CardAnchors
}) {
  const isCompact = props.band === 'building'
  const register = (agentKey: string) => (element: HTMLElement | null) => {
    if (element) props.anchors.set(agentKey, element)
    else props.anchors.delete(agentKey)
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {props.cards.map((card) =>
        card.kind === 'pill' ? (
          <span
            key={card.agentKey}
            ref={register(card.agentKey)}
            style={{ transform: OFFSCREEN }}
            className={cn(
              'absolute left-0 top-0 whitespace-nowrap rounded-full bg-white/90 px-1.5 py-px text-[10px] font-semibold text-neutral-800 shadow',
              isCompact && 'hidden'
            )}
          >
            {card.title}
          </span>
        ) : (
          <div
            key={card.agentKey}
            ref={register(card.agentKey)}
            style={{ transform: OFFSCREEN }}
            className={cn(
              'absolute left-0 top-0 flex flex-col whitespace-nowrap rounded-lg bg-white text-neutral-900 shadow-md',
              isCompact ? 'px-1.5 py-0.5' : 'px-2.5 py-1',
              card.agentKey === props.selectedAgentKey && 'outline outline-2 outline-accent'
            )}
          >
            <span className="flex items-center gap-1.5">
              <StatusDot card={card} />
              <span
                className={cn(
                  'font-bold uppercase tracking-wide',
                  isCompact ? 'text-[9px]' : 'text-[11px]'
                )}
              >
                {card.title}
              </span>
            </span>
            {!isCompact && (
              <span className="pl-3.5 text-[10px] text-neutral-600">{card.detail}</span>
            )}
          </div>
        )
      )}
    </div>
  )
}
