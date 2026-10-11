import { describe, expect, it } from 'vitest'
import { buildNameCards, buildProjectStacks, MAX_NAME_CARDS } from '../logic/name-cards'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession, makeZone } from './fixtures'

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

  it('keeps every agent with something wrong when the cap drops quiet ones', () => {
    const crowd = makeFrame({
      floors: [floor],
      agents: [
        ...Array.from({ length: 60 }, (_, index) =>
          makeAgent({ agentKey: `bot-${index}`, roomId: 'r1', activity: 'editing' })
        ),
        makeAgent({ agentKey: 'broken', roomId: 'r1', attention: 'error' }),
        makeAgent({ agentKey: 'limited', roomId: 'r1', attention: 'limited' })
      ]
    })
    const keys = buildNameCards(crowd, 'f1', null).map((card) => card.agentKey)
    expect(keys).toEqual(expect.arrayContaining(['broken', 'limited']))
  })

  it('carries the project and last update so ties go to the most recent', () => {
    const office = buildNameCards(frame, 'f1', null).find((card) => card.agentKey === 'a')
    expect(office).toMatchObject({ projectKey: 'p_1', updatedAtMs: 0 })
  })
})

describe('buildProjectStacks', () => {
  it('summarises a project for its stacked badge and anchors it on the project office', () => {
    const zoned = makeFrame({
      ...frame,
      floors: [
        makeFloor({
          ...floor,
          zones: [
            makeZone({
              id: 'c',
              kind: 'company',
              children: [
                makeZone({
                  id: 'p-zone',
                  kind: 'project',
                  label: 'PropApp',
                  projectKey: 'p_1',
                  x: 7,
                  z: -3
                })
              ]
            })
          ]
        })
      ]
    })
    expect(buildProjectStacks(zoned, 'f1')).toEqual([
      expect.objectContaining({
        projectKey: 'p_1',
        zoneId: 'p-zone',
        x: 7,
        z: -3,
        text: 'PropApp · 3 agents · 1 needs you'
      })
    ])
  })
})
