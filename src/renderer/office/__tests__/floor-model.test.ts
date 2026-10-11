import { describe, expect, it } from 'vitest'
import { buildListTree, summariseFloors } from '../logic/floor-model'
import { makeAgent, makeFloor, makeFrame, makeRoom } from './fixtures'

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

describe('buildListTree', () => {
  it('nests Floor › Room › Agent with the main agent before subagents', () => {
    const tree = buildListTree(frame)
    expect(tree.map((floor) => floor.label)).toEqual(['ClaudeWatch', 'PropApp'])
    expect(tree[0].rooms.map((room) => room.label)).toEqual(['store.ts', 'empty'])
    expect(tree[0].rooms[0].agents.map((agent) => agent.agentKey)).toEqual(['main', 'sub'])
    expect(tree[0].rooms[1].agents).toEqual([])
  })
})
