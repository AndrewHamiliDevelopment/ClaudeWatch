import { describe, expect, it } from 'vitest'
import {
  buildCompanyList,
  buildOfficesTree,
  COMPANY_GATE_WIDTH,
  findZone,
  PROJECT_DOOR_WIDTH,
  zoneSignPlacement,
  zoneWalls
} from '../logic/zone-model'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession, makeZone } from './fixtures'

const zones = [
  makeZone({
    id: 'c-zk',
    kind: 'company',
    label: 'ZKidz',
    companyKey: 'c_zk',
    x: -20,
    width: 30,
    depth: 20,
    door: { x: -20, z: 10 },
    children: [
      makeZone({
        id: 'p-cw',
        kind: 'project',
        label: 'ClaudeWatch',
        companyKey: 'c_zk',
        projectKey: 'p_cw',
        x: -24,
        z: 2,
        width: 12,
        depth: 9,
        door: { x: -24, z: 6.5 },
        children: [
          makeZone({ id: 'o-a', kind: 'office', sessionKey: 'claude:a', projectKey: 'p_cw' })
        ]
      }),
      makeZone({
        id: 'p-empty',
        kind: 'project',
        label: 'Idle repo',
        companyKey: 'c_zk',
        projectKey: 'p_idle'
      })
    ]
  }),
  makeZone({ id: 'c-ac', kind: 'company', label: 'Acme', companyKey: 'c_ac', x: 20, children: [] })
]

const frame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'one',
      zones,
      rooms: [
        makeRoom({ id: 'o-a', sessionKey: 'claude:a', label: 'office renderer' }),
        makeRoom({ id: 'o-b', sessionKey: 'claude:b', label: 'billing' })
      ]
    })
  ],
  sessions: [
    makeSession({
      key: 'claude:a',
      name: 'office renderer',
      projectKey: 'p_cw',
      projectLabel: 'ClaudeWatch',
      companyKey: 'c_zk',
      companyLabel: 'ZKidz',
      attention: 'permission'
    }),
    makeSession({
      key: 'claude:b',
      name: 'billing',
      projectKey: 'p_bill',
      projectLabel: 'Billing',
      companyKey: 'c_ac',
      companyLabel: 'Acme'
    })
  ],
  agents: [
    makeAgent({
      agentKey: 'a/sub',
      floorId: 'one',
      roomId: 'o-a',
      isSubagent: true,
      label: 'Explore'
    }),
    makeAgent({
      agentKey: 'a',
      floorId: 'one',
      roomId: 'o-a',
      label: 'office renderer',
      attention: 'permission'
    }),
    makeAgent({ agentKey: 'b', floorId: 'one', roomId: 'o-b', label: 'billing' })
  ]
})

describe('buildOfficesTree', () => {
  const tree = buildOfficesTree(frame)

  it('lists companies with their projects and the zones to fly to', () => {
    expect(tree.map((company) => company.label)).toEqual(['ZKidz', 'Acme'])
    expect(tree[0].zoneId).toBe('c-zk')
    expect(tree[0].projects.map((project) => [project.label, project.zoneId])).toEqual([
      ['ClaudeWatch', 'p-cw'],
      ['Idle repo', 'p-empty']
    ])
  })

  it('counts agents (with subagents) and waiting sessions per project and company', () => {
    expect(tree[0].projects[0]).toMatchObject({
      projectKey: 'p_cw',
      agentCount: 2,
      attentionCount: 1
    })
    expect(tree[0]).toMatchObject({ agentCount: 2, attentionCount: 1 })
  })

  it('still lists a session whose project has no zone yet', () => {
    expect(tree[1].projects).toEqual([
      expect.objectContaining({
        projectKey: 'p_bill',
        label: 'Billing',
        zoneId: null,
        agentCount: 1
      })
    ])
  })
})

describe('buildCompanyList', () => {
  it('groups agents Company › Project › Agent with each main agent before its subagents', () => {
    const list = buildCompanyList(frame)
    expect(list.map((company) => company.label)).toEqual(['ZKidz', 'Acme'])
    expect(list[0].projects[0].agents.map((agent) => agent.agentKey)).toEqual(['a', 'a/sub'])
    expect(list[1].projects[0].label).toBe('Billing')
  })
})

describe('zoneWalls', () => {
  const length = (zone: Parameters<typeof zoneWalls>[0]) =>
    zoneWalls(zone).reduce((total, segment) => total + segment.length, 0)

  it('leaves a wide gate in a company fence and a door gap in a project office', () => {
    // Perimeter 2 × (30 + 20) = 100 m.
    expect(length(zones[0])).toBeCloseTo(100 - COMPANY_GATE_WIDTH)
    // Perimeter 2 × (12 + 9) = 42 m.
    expect(length(zones[0].children[0])).toBeCloseTo(42 - PROJECT_DOOR_WIDTH)
  })

  it('opens a doorless zone at the middle of its front edge', () => {
    expect(length(zones[1])).toBeCloseTo(2 * (6 + 5) - COMPANY_GATE_WIDTH)
  })
})

describe('zones', () => {
  it('finds a zone anywhere in the tree', () => {
    expect(findZone(frame.floors[0], 'o-a')?.sessionKey).toBe('claude:a')
    expect(findZone(frame.floors[0], 'missing')).toBeUndefined()
  })

  it('hangs a sign at the zone door, facing out, or at the front edge with no door', () => {
    const doored = zoneSignPlacement(zones[0].children[0])
    expect(doored.z).toBeGreaterThan(6.5)
    expect(doored.rotationY).toBeCloseTo(0)
    const doorless = zoneSignPlacement(zones[1])
    // Just outside the front edge (depth 5 → edge at 2.5), like door signs.
    expect(doorless.z).toBeGreaterThan(2.5)
    expect(doorless.z).toBeLessThan(2.7)
  })
})
