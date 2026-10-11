import { describe, expect, it } from 'vitest'
import { sessionForAgent, summariseFloors } from '../logic/floor-model'
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
