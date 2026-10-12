import { describe, expect, it } from 'vitest'
import { bayForAgent, memberForAgent, sessionForAgent, summariseFloors } from '../logic/floor-model'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from './fixtures'

const frame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'f1',
      label: 'ClaudeWatch',
      rooms: [makeRoom({ id: 'r1', label: 'store.ts' }), makeRoom({ id: 'r2', label: 'empty' })]
    }),
    makeFloor({ floorId: 'f2', label: 'PropApp', rooms: [makeRoom({ id: 'r3' })] })
  ],
  agents: [
    makeAgent({ agentKey: 'sub', floorId: 'f1', roomId: 'r1', isSubagent: true, label: 'Explore' }),
    makeAgent({ agentKey: 'main', floorId: 'f1', roomId: 'r1', attention: 'permission' }),
    makeAgent({ agentKey: 'other', floorId: 'f2', roomId: 'r3', attention: 'done' })
  ]
})

describe('summariseFloors', () => {
  it('counts agents and attention per floor, numbered from 1', () => {
    expect(summariseFloors(frame)).toEqual([
      { floorId: 'f1', label: 'ClaudeWatch', number: 1, agentCount: 2, attentionCount: 1 },
      { floorId: 'f2', label: 'PropApp', number: 2, agentCount: 1, attentionCount: 0 }
    ])
  })
})

describe('memberForAgent', () => {
  const lead = makeSession({
    key: 'claude:a',
    subagents: [
      { id: 's1', type: 'Explore', activity: 'reading' },
      { id: 't1', type: 'lena', name: 'lena-hud', kind: 'teammate', activity: 'editing' }
    ]
  })

  it('finds the subagent or teammate an agent key names', () => {
    expect(memberForAgent(lead, 'claude:a#t1')?.name).toBe('lena-hud')
    expect(memberForAgent(lead, 'claude:a#s1')?.type).toBe('Explore')
  })

  it('has none for the lead itself, another session or an unknown id', () => {
    expect(memberForAgent(lead, 'claude:a')).toBeUndefined()
    expect(memberForAgent(lead, 'claude:ab#t1')).toBeUndefined()
    expect(memberForAgent(lead, 'claude:a#gone')).toBeUndefined()
    expect(memberForAgent(undefined, 'claude:a#t1')).toBeUndefined()
  })
})

describe('bayForAgent', () => {
  it('reads the office bay of the agent room, and 0 where there is none', () => {
    const bays = makeFrame({
      floors: [
        makeFloor({
          floorId: 'f1',
          rooms: [makeRoom({ id: 'r1', bay: 3 }), makeRoom({ id: 'team', kind: 'team' })]
        })
      ]
    })
    expect(bayForAgent(bays, makeAgent({ agentKey: 'a', roomId: 'r1' }))).toBe(3)
    expect(bayForAgent(bays, makeAgent({ agentKey: 'b', roomId: 'team' }))).toBe(0)
  })
})

describe('sessionForAgent', () => {
  it('finds the session of a subagent seated in the shared team area', () => {
    const session = makeSession({ key: 'claude:a' })
    const team = makeFrame({
      floors: [
        makeFloor({
          floorId: 'f1',
          rooms: [
            makeRoom({ id: 'office', sessionKey: 'claude:a' }),
            makeRoom({ id: 'team', kind: 'team', sessionKey: null })
          ]
        })
      ],
      sessions: [session, makeSession({ key: 'claude:ab' })]
    })
    const overflow = makeAgent({ agentKey: 'claude:a#3', roomId: 'team', isSubagent: true })
    expect(sessionForAgent(team, overflow)).toBe(session)
    expect(
      sessionForAgent(team, makeAgent({ agentKey: 'stranger', roomId: 'team' }))
    ).toBeUndefined()
  })
})
