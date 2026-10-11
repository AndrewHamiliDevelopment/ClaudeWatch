import { describe, expect, it } from 'vitest'
import { cullCards, STACK_THRESHOLD, type CullCandidate, type Rect } from '../logic/card-culling'
import type { CardStatus } from '../logic/name-cards'

const SAFE: Rect = { left: 280, top: 0, right: 1144, bottom: 804 }

function candidate(
  agentKey: string,
  status: CardStatus,
  at: { x: number; y: number },
  overrides: Partial<CullCandidate> = {}
): CullCandidate {
  return {
    agentKey,
    projectKey: 'p',
    status,
    updatedAtMs: 0,
    isSelected: false,
    rect: { left: at.x, top: at.y, right: at.x + 120, bottom: at.y + 24 },
    ...overrides
  }
}

describe('cullCards', () => {
  it('keeps cards that do not overlap', () => {
    const outcome = cullCards(
      [candidate('a', 'idle', { x: 400, y: 100 }), candidate('b', 'idle', { x: 600, y: 100 })],
      SAFE
    )
    expect([...outcome.cards].sort()).toEqual(['a', 'b'])
    expect(outcome.dots.size).toBe(0)
  })

  it('keeps the higher-priority card on overlap and turns the other into a dot', () => {
    const order: CardStatus[] = ['permission', 'waiting', 'error', 'working', 'done', 'idle']
    for (let index = 0; index < order.length - 1; index += 1) {
      const outcome = cullCards(
        [
          candidate('low', order[index + 1], { x: 400, y: 100 }),
          candidate('high', order[index], { x: 430, y: 105 })
        ],
        SAFE
      )
      expect([...outcome.cards]).toEqual(['high'])
      expect([...outcome.dots]).toEqual(['low'])
    }
  })

  it('breaks ties toward the most recent update', () => {
    const outcome = cullCards(
      [
        candidate('old', 'working', { x: 400, y: 100 }, { updatedAtMs: 1 }),
        candidate('new', 'working', { x: 410, y: 100 }, { updatedAtMs: 9 })
      ],
      SAFE
    )
    expect([...outcome.cards]).toEqual(['new'])
  })

  it('always keeps the selected card, even over a permission prompt', () => {
    const outcome = cullCards(
      [
        candidate('ask', 'permission', { x: 400, y: 100 }),
        candidate('picked', 'idle', { x: 410, y: 100 }, { isSelected: true })
      ],
      SAFE
    )
    expect(outcome.cards.has('picked')).toBe(true)
    expect(outcome.dots.has('ask')).toBe(true)
  })

  it('drops cards that would sit under the HUD rails to dots', () => {
    const outcome = cullCards([candidate('under-rail', 'working', { x: 100, y: 100 })], SAFE)
    expect(outcome.cards.size).toBe(0)
    expect(outcome.dots.has('under-rail')).toBe(true)
  })

  it(`stacks a project when more than ${STACK_THRESHOLD} of its cards overlap`, () => {
    const crowd = Array.from({ length: STACK_THRESHOLD + 1 }, (_, index) =>
      candidate(`c${index}`, index === 0 ? 'permission' : 'working', {
        x: 400 + index * 10,
        y: 100
      })
    )
    const stacked = cullCards(crowd, SAFE)
    expect([...stacked.stackedProjects]).toEqual(['p'])
    expect(stacked.cards.size).toBe(0)
    expect(stacked.dots.size).toBe(crowd.length)

    const few = cullCards(crowd.slice(0, STACK_THRESHOLD), SAFE)
    expect(few.stackedProjects.size).toBe(0)
    expect(few.cards.size).toBe(1)
  })

  it('keeps the selected card out of a stack', () => {
    const crowd = Array.from({ length: 5 }, (_, index) =>
      candidate(`c${index}`, 'working', { x: 400 + index * 5, y: 100 }, { isSelected: index === 2 })
    )
    const outcome = cullCards(crowd, SAFE)
    expect(outcome.stackedProjects.has('p')).toBe(true)
    expect([...outcome.cards]).toEqual(['c2'])
  })

  it('never hides an agent that needs attention: every card is a card or a dot', () => {
    const crowd = Array.from({ length: 9 }, (_, index) =>
      candidate(`c${index}`, index % 3 === 0 ? 'permission' : 'waiting', {
        x: 300 + index * 7,
        y: 100 + index
      })
    )
    const outcome = cullCards(crowd, SAFE)
    for (const card of crowd)
      expect(outcome.cards.has(card.agentKey) || outcome.dots.has(card.agentKey)).toBe(true)
  })
})
