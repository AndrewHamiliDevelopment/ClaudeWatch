import { describe, expect, it } from 'vitest'
import { buildNameCards, MAX_NAME_CARDS } from '../logic/name-cards'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from './fixtures'

const floor = makeFloor({
  floorId: 'f1',
  rooms: [
    makeRoom({ id: 'r1', sessionKey: 'claude:a' }),
    makeRoom({ id: 'r2', sessionKey: 'claude:b' })
  ]
})

const frame = makeFrame({
  floors: [floor, makeFloor({ floorId: 'f2' })],
  sessions: [
    makeSession({
      key: 'claude:a',
      name: 'office renderer',
      activity: 'editing',
      currentTool: { name: 'Bash', category: 'run' }
    }),
    makeSession({ key: 'claude:b', name: 'auth migration', attention: 'permission' })
  ],
  agents: [
    makeAgent({ agentKey: 'a', roomId: 'r1', activity: 'editing', x: 1, z: 2, heading: 0 }),
    makeAgent({ agentKey: 'a/s', roomId: 'r1', isSubagent: true, label: 'Explore' }),
    makeAgent({ agentKey: 'b', roomId: 'r2', attention: 'permission' }),
    makeAgent({ agentKey: 'elsewhere', floorId: 'f2', roomId: 'x' })
  ]
})

describe('buildNameCards', () => {
  const cards = buildNameCards(frame, 'f1', null)

  it('gives main agents a card with name, role line and status, and subagents a pill', () => {
    const office = cards.find((card) => card.agentKey === 'a')
    expect(office).toMatchObject({
      kind: 'card',
      title: 'office renderer',
      detail: 'Editing · Bash',
      status: 'working'
    })
    expect(cards.find((card) => card.agentKey === 'a/s')).toMatchObject({
      kind: 'pill',
      title: 'Explore'
    })
    expect(cards.find((card) => card.agentKey === 'b')).toMatchObject({
      status: 'permission',
      detail: 'Needs permission'
    })
  })

  it('floats the card over the desk in front of the agent', () => {
    const office = cards.find((card) => card.agentKey === 'a')
    expect(office?.x).toBeCloseTo(1)
    expect(office?.z).toBeGreaterThan(2)
  })

  it('shows only the focused floor and puts waiting agents first', () => {
    expect(cards.some((card) => card.agentKey === 'elsewhere')).toBe(false)
    expect(cards[0].agentKey).toBe('b')
  })

  it('clamps how many cards are drawn', () => {
    const crowd = makeFrame({
      floors: [floor],
      agents: Array.from({ length: 40 }, (_, index) =>
        makeAgent({ agentKey: `bot-${index}`, roomId: 'r1' })
      )
    })
    expect(buildNameCards(crowd, 'f1', null).length).toBeLessThanOrEqual(MAX_NAME_CARDS)
  })
})
