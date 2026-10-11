import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { NameCard } from '../logic/name-cards'
import type { CardAnchors } from './CardProjector'
import { NameCardLayer } from './NameCards'

vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))

function card(agentKey: string): NameCard {
  return {
    agentKey,
    sessionKey: null,
    kind: 'card',
    x: 0,
    z: 0,
    title: agentKey,
    detail: 'Working',
    status: 'working',
    projectKey: 'p',
    updatedAtMs: 0
  }
}

it('keeps the remaining cards mounted when the first agent leaves', () => {
  const anchors: CardAnchors = { cards: new Map(), dots: new Map(), stacks: new Map() }
  const layer = (cards: NameCard[]) => (
    <NameCardLayer
      cards={cards}
      stacks={[]}
      band="floor"
      selectedAgentKey={null}
      anchors={anchors}
      reviewableKeys={new Set()}
      onReview={vi.fn()}
      onFlyToZone={vi.fn()}
    />
  )
  const { rerender } = render(layer([card('a'), card('b'), card('c')]))
  const cardBefore = anchors.cards.get('c')
  const dotBefore = anchors.dots.get('c')

  rerender(layer([card('b'), card('c')]))

  expect(cardBefore?.isConnected).toBe(true)
  expect(anchors.cards.get('c')).toBe(cardBefore)
  expect(anchors.dots.get('c')).toBe(dotBefore)
  expect(anchors.cards.has('a')).toBe(false)
})
