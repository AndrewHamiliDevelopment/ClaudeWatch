import { describe, expect, it } from 'vitest'
import { buildLayout, type LayoutMap } from './layout'
import { session } from './fixtures'
import { officeGrid } from './navigation'
import { findPath } from './path'
import { placements } from './placements'

const inCompany = (company: string, project: string, seat = '') => ({
  ...session(`${company}-${project}${seat && `-${seat}`}`, `p_${company}_${project}`),
  companyKey: `c_${company}`,
  companyLabel: company
})

interface Box {
  x: number
  z: number
  width: number
  depth: number
}
const area = (box: Pick<Box, 'width' | 'depth'>) => box.width * box.depth
// The clear strip between two boxes; negative when they overlap.
const lane = (a: Box, b: Box) =>
  Math.max(
    Math.abs(a.x - b.x) - (a.width + b.width) / 2,
    Math.abs(a.z - b.z) - (a.depth + b.depth) / 2
  )
const isInside = (inner: Box, outer: Box) =>
  Math.abs(inner.x - outer.x) + inner.width / 2 <= outer.width / 2 &&
  Math.abs(inner.z - outer.z) + inner.depth / 2 <= outer.depth / 2
const pairs = <T>(boxes: T[]): [T, T][] =>
  boxes.flatMap((first, index) => boxes.slice(index + 1).map((second): [T, T] => [first, second]))
const liveBays = (layout: LayoutMap) =>
  layout.floors[0].rooms
    .filter((room) => room.kind === 'office')
    .map((room) => room.bay)
    .sort((a, b) => a - b)
function expectClearLanes(layout: LayoutMap): void {
  const floor = layout.floors[0]
  for (const [first, second] of pairs(floor.zones))
    expect(lane(first, second)).toBeGreaterThanOrEqual(3)
  for (const company of floor.zones) {
    // The plate has its own centre and leaves the 3 m margin around every company.
    expect(
      isInside({ ...company, width: company.width + 6, depth: company.depth + 6 }, floor)
    ).toBe(true)
    const grounds = [...company.children, company.lounge!]
    for (const zone of grounds) expect(isInside(zone, company)).toBe(true)
    for (const [first, second] of pairs(grounds))
      expect(lane(first, second)).toBeGreaterThanOrEqual(3)
    for (const project of company.children)
      for (const leaf of project.children) expect(isInside(leaf, project)).toBe(true)
  }
}

type Seed = [company: string, project: string, sessions: number][]
const sessionsOf = (seed: Seed) =>
  seed.flatMap(([company, project, count]) =>
    Array.from({ length: count }, (_, seat) => inCompany(company, project, `${seat}`))
  )
const workers = (count: number) =>
  Array.from({ length: count }, (_, id) => ({
    id: `${id}`,
    type: 'worker',
    activity: 'reading' as const
  }))
// A session's bay and where its office sits, measured from its company's top-left corner.
function placeInCompany(layout: LayoutMap, sessionKey: string) {
  const floor = layout.floors[0]
  const room = floor.rooms.find((candidate) => candidate.sessionKey === sessionKey)!
  const company = floor.zones.find((zone) => zone.companyKey === room.companyKey)!
  return {
    bay: room.bay,
    x: room.x - (company.x - company.width / 2),
    z: room.z - (company.z - company.depth / 2)
  }
}

describe("a floor shaped like the owner's: one company of four projects and two of one", () => {
  const OWNER: Seed = [
    ['zkidz', '1', 3],
    ['zkidz', '2', 2],
    ['zkidz', '3', 1],
    ['zkidz', '4', 2],
    ['alpha', '1', 1],
    ['beta', '1', 1]
  ]
  const built = () => buildLayout(sessionsOf(OWNER), undefined, 0)
  const sizes = (boxes: Box[]) => boxes.map((box) => [box.width, box.depth])

  it('keeps all the company grounds within 1,900 m2', () => {
    const grounds = built().floors[0].zones.reduce((total, company) => total + area(company), 0)
    expect(grounds).toBeLessThanOrEqual(1900)
  })
  it('uses at least 45% of the grounds for project offices and lounges', () => {
    const companies = built().floors[0].zones
    const grounds = companies.reduce((total, company) => total + area(company), 0)
    const used = companies
      .flatMap((company) => [...company.children, company.lounge!])
      .reduce((total, box) => total + area(box), 0)
    expect(used / grounds).toBeGreaterThanOrEqual(0.45)
  })
  it('makes a project as wide as its desk columns, and a one-session one within 9 x 9 m', () => {
    const [alpha, beta, zkidz] = built().floors[0].zones
    expect(sizes(zkidz.children)).toEqual([
      [16, 8],
      [11, 8],
      [6, 8],
      [11, 8]
    ])
    expect(sizes([...alpha.children, ...beta.children])).toEqual([
      [6, 8],
      [6, 8]
    ])
  })
  it('overlaps nothing and keeps every lane at least 3 m wide', () => {
    expectClearLanes(built())
  })
  it('gives the widest company one side of the street and the two small ones the other', () => {
    const floor = built().floors[0]
    const [alpha, beta, zkidz] = floor.zones
    expect([alpha, beta, zkidz].map((company) => Math.sign(company.z))).toEqual([-1, -1, 1])
    expect([floor.width, floor.depth]).toEqual([71, 31])
  })
  it('keeps the plate within 71 x 31 m with at least half of it company grounds', () => {
    const floor = built().floors[0]
    const grounds = floor.zones.reduce((total, company) => total + area(company), 0)
    expect(floor).toMatchObject({ width: 71, depth: 31, x: 34, z: 0 })
    expect(grounds / area(floor)).toBeGreaterThanOrEqual(0.5)
  })
  it("makes a lone company's plate its grounds, the street and the margins", () => {
    const alone = sessionsOf(OWNER.filter(([company]) => company === 'zkidz'))
    const floor = buildLayout(alone, undefined, 0).floors[0]
    expect(sizes(floor.zones)).toEqual([[65, 11]])
    // The gate's 3 m, 65 m of grounds, 3 m of margin; the 3 m street, 11 m of grounds, 3 m.
    expect(floor).toMatchObject({ width: 71, depth: 17, x: 34, z: 7 })
    expect(floor.elevator).toMatchObject({ x: 0, z: 0 })
    expect(isInside({ ...floor.elevator, width: 3, depth: 3 }, floor)).toBe(true)
    // The lift stands 3 m short of the company's own gateway.
    expect(floor.zones[0].door).toEqual({ x: 3, z: 1.5 })
  })
  it("leaves every other company's rooms where they were when a company grows", () => {
    const layout = built()
    const roomsOf = (map: LayoutMap, companyKey: string) =>
      map.floors[0].rooms.filter((room) => room.companyKey === companyKey)
    const grownBy = (joiner: ReturnType<typeof inCompany>) =>
      buildLayout([...sessionsOf(OWNER), joiner], layout, 1)
    // zkidz has its side of the street to itself: a desk column or a project moves nobody else.
    for (const grown of [grownBy(inCompany('zkidz', '3', 'x')), grownBy(inCompany('zkidz', '9'))]) {
      expect(roomsOf(grown, 'c_zkidz')).not.toEqual(roomsOf(layout, 'c_zkidz'))
      for (const other of ['c_alpha', 'c_beta'])
        expect(roomsOf(grown, other)).toEqual(roomsOf(layout, other))
    }
    // beta is the last company in its row.
    const last = grownBy(inCompany('beta', '1', 'x'))
    for (const other of ['c_alpha', 'c_zkidz'])
      expect(roomsOf(last, other)).toEqual(roomsOf(layout, other))
    // alpha stands before beta in the same row: its desk column pushes beta 5 m, and only beta.
    const first = grownBy(inCompany('alpha', '1', 'x'))
    expect(roomsOf(first, 'c_zkidz')).toEqual(roomsOf(layout, 'c_zkidz'))
    expect(roomsOf(first, 'c_beta').map((room) => [room.x, room.z])).toEqual(
      roomsOf(layout, 'c_beta').map((room) => [room.x + 5, room.z])
    )
  })
  it("keeps a project's place while it and its earlier neighbours stay the same size", () => {
    const layout = built()
    const joiners = ['x', 'y'].map((seat) => inCompany('zkidz', '3', seat))
    const grown = buildLayout([...sessionsOf(OWNER), ...joiners], layout, 1)
    const moved = (key: string) => placeInCompany(grown, key).x - placeInCompany(layout, key).x
    for (const live of sessionsOf(OWNER)) {
      // Two more desk columns in project 3 push only project 4, the one after it.
      if (live.projectKey === 'p_zkidz_4') expect(moved(live.key)).toBe(10)
      else expect(placeInCompany(grown, live.key)).toEqual(placeInCompany(layout, live.key))
    }
    expectClearLanes(grown)
  })
})

it('adds a desk column for each session up to four, then a second row', () => {
  const project = (count: number) => {
    const crew = Array.from({ length: count }, (_, seat) => session(`s${seat}`))
    const { width, depth, capacity } = buildLayout(crew, undefined, 0).floors[0].zones[0]
      .children[0]
    return [width, depth, capacity]
  }
  expect([1, 2, 3, 4, 5, 8, 9].map(project)).toEqual([
    [6, 8, 4],
    [11, 8, 4],
    [16, 8, 4],
    [21, 8, 4],
    [21, 14, 8],
    [21, 14, 8],
    [21, 20, 12]
  ])
})

it('has no team area without subagents, and one only as large as the overflow needs', () => {
  const teamFor = (subagents: number) => {
    const sessions = [{ ...session('a'), subagents: workers(subagents) }]
    const layout = buildLayout(sessions, undefined, 0)
    expect(placements(sessions, layout)).toHaveLength(1 + subagents)
    const team = layout.floors[0].rooms.find((room) => room.kind === 'team')
    return team && [team.slots.filter((slot) => slot.id !== 'door').length, team.width, team.depth]
  }
  expect(teamFor(0)).toBeUndefined()
  // placements.ts looks the team room up for any subagent, so one seat stays while guests fit.
  expect(teamFor(2)).toEqual([1, 4, 4])
  expect(teamFor(7)).toEqual([5, 6, 8])
})

const many = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...session(`s${String(i).padStart(3, '0')}`, `p_${i % 12}`),
    companyKey: `c_${i % 4}`,
    companyLabel: `Company ${i % 4}`
  }))

describe('nested headquarters layout', () => {
  it('is deterministic for 60 sessions in 12 projects and four companies', () => {
    const sessions = many(60)
    const layout = buildLayout(sessions, undefined, 0)
    expect(layout).toEqual(buildLayout([...sessions].reverse(), undefined, 0))
    expect(layout.floors).toHaveLength(1)
    expect(layout.floors[0].id).toBe('hq')
    expect(layout.floors[0].zones).toHaveLength(4)
    expect(layout.floors[0].zones.flatMap((c) => c.children)).toHaveLength(12)
    expect(layout.floors[0].rooms.filter((r) => r.sessionKey)).toHaveLength(60)
  })
  it('keeps a desk and its place in the company across additions, removals and reloads', () => {
    const saved = buildLayout([session('b')], undefined, 0)
    const before = JSON.stringify(saved)
    const next = buildLayout([session('a'), session('b')], saved, 1)
    expect(next.reservations.b).toEqual(saved.reservations.b)
    // The company widens to the east for the second desk column; b's office does not move.
    expect(next.floors[0].rooms.find((r) => r.sessionKey === 'b')).toEqual(saved.floors[0].rooms[0])
    expect(next.floors[0].zones[0].width).toBeGreaterThan(saved.floors[0].zones[0].width)
    expect(JSON.stringify(saved)).toBe(before)
    const removed = buildLayout([session('b')], next, 2)
    expect(buildLayout([session('a'), session('b')], removed, 3).reservations.a).toEqual(
      next.reservations.a
    )
  })
  it('reserves in steps of four and grows without moving an office inside its company', () => {
    const initial = buildLayout([session('a')], undefined, 0)
    const expanded = buildLayout(
      Array.from({ length: 9 }, (_, i) => session(i ? `b${i}` : 'a')),
      initial,
      1
    )
    expect(initial.floors[0].zones[0].children[0].capacity).toBe(4)
    expect(expanded.floors[0].zones[0].children[0].capacity).toBe(12)
    expect(placeInCompany(expanded, 'a')).toEqual(placeInCompany(initial, 'a'))
  })
  it('drops a project and a company with their last session, and the floor shrinks', () => {
    const remaining = [session('b', 'p_b')]
    const full = buildLayout([session('a'), ...remaining, inCompany('other', '1')], undefined, 0)
    const fewer = buildLayout(remaining, full, 100)
    expect(fewer.floors[0].zones.map((company) => company.id)).toEqual(['company:c_work'])
    expect(fewer.floors[0].zones[0].children.map((project) => project.projectKey)).toEqual(['p_b'])
    expect(Object.keys(fewer.reservations)).toEqual(['b'])
    expect(area(fewer.floors[0])).toBeLessThan(area(full.floors[0]))
    expect(area(fewer.floors[0])).toBe(area(buildLayout(remaining, undefined, 0).floors[0]))

    const empty = buildLayout([], fewer, 200)
    expect(empty.floors[0]).toMatchObject({ zones: [], rooms: [], width: 12, depth: 12 })
    expect(empty.reservations).toEqual({})
  })
  it('moves a session down only to close a row or a desk column, never for an arrival', () => {
    const bayOf = (layout: LayoutMap) =>
      Object.fromEntries(Object.entries(layout.reservations).map(([key, held]) => [key, held.bay]))
    // Seven sessions still need both rows, so the freed desk waits for a newcomer.
    const eight = Array.from({ length: 8 }, (_, seat) => session(`k${seat}`))
    const seven = buildLayout(eight.slice(1), buildLayout(eight, undefined, 0), 1)
    expect(bayOf(seven)).toEqual({ k1: 1, k2: 2, k3: 3, k4: 4, k5: 5, k6: 6, k7: 7 })
    expect(bayOf(buildLayout(eight, seven, 2)).k0).toBe(0)

    const five = ['a', 'b', 'c', 'd', 'e'].map((key) => session(key))
    const full = buildLayout(five, undefined, 0)
    expect(bayOf(full)).toEqual({ a: 0, b: 1, c: 2, d: 3, e: 4 })

    // Only the session in the last bay moves, into the freed one, and the second row closes.
    const closed = buildLayout(
      five.filter((s) => s.key !== 'b'),
      full,
      1
    )
    expect(bayOf(closed)).toEqual({ a: 0, c: 2, d: 3, e: 1 })
    expect(closed.floors[0].zones[0].children[0].capacity).toBe(4)

    const holed = buildLayout(
      five.filter((s) => s.key !== 'b' && s.key !== 'e'),
      closed,
      2
    )
    // Three sessions in one row: the one in the fourth column moves in so that column closes.
    expect(bayOf(holed)).toEqual({ a: 0, c: 2, d: 1 })
    expect(holed.floors[0].zones[0].children[0].width).toBe(16)

    const joined = buildLayout([...five.filter((s) => s.key !== 'b'), session('z')], holed, 3)
    expect(bayOf(joined)).toEqual({ a: 0, c: 2, d: 1, e: 3, z: 4 })
  })
  it('treats a saved order or bay that is not a whole number as never saved', () => {
    const sessions = [session('a'), session('b')]
    const saved = buildLayout(sessions, undefined, 0)
    saved.reservations.b.bay = 1.5
    saved.floors[0].zones[0].index = Number.NaN
    saved.floors[0].zones[0].children[0].index = -2
    expect(buildLayout(sessions, saved, 1)).toEqual(buildLayout(sessions, undefined, 0))
  })
  it('keeps two guests at their parent and allocates overflow per project', () => {
    const sessions = ['p_a', 'p_b'].map((p) => ({
      ...session(p, p),
      subagents: Array.from({ length: 17 }, (_, i) => ({
        id: String(i),
        type: 'worker',
        activity: 'reading' as const
      }))
    }))
    const layout = buildLayout(sessions, undefined, 0)
    const agents = placements(sessions, layout)
    expect(agents.filter((p) => p.slot.id.startsWith('desk_guest'))).toHaveLength(4)
    expect(agents.filter((p) => p.room.kind === 'team')).toHaveLength(30)
    for (const agent of agents) expect(agent.room.projectKey).toBe(agent.session.projectKey)
    expect(new Set(agents.map((p) => `${p.room.id}:${p.slot.id}`)).size).toBe(36)
  })
})

it('keeps a project in its place when a lexically earlier project arrives', () => {
  const saved = buildLayout([session('z', 'p_z')], undefined, 0)
  const next = buildLayout([session('z', 'p_z'), session('a', 'p_a')], saved, 1)
  expect(placeInCompany(next, 'z')).toEqual(placeInCompany(saved, 'z'))
  const projects = next.floors[0].zones[0].children
  expect(projects[0].x === projects[1].x && projects[0].z === projects[1].z).toBe(false)
})

it('moves only the projects after a busy one when it grows', () => {
  const sessions = [session('a', 'p_a'), session('b', 'p_b'), session('c', 'p_c')]
  const saved = buildLayout(sessions, undefined, 0)
  const grown = buildLayout(
    [...sessions, ...Array.from({ length: 20 }, (_, i) => session(`new${i}`, 'p_b'))],
    saved,
    1
  )
  expect(placeInCompany(grown, 'a')).toEqual(placeInCompany(saved, 'a'))
  expect(placeInCompany(grown, 'b')).toEqual(placeInCompany(saved, 'b'))
  // p_b went from one desk column to four: p_c stands 15 m further along the shelf.
  expect(placeInCompany(grown, 'c')).toEqual({
    ...placeInCompany(saved, 'c'),
    x: placeInCompany(saved, 'c').x + 15
  })
})

it('keeps every project inside its company after growth and pruning a slot', () => {
  const sessions = Array.from({ length: 7 }, (_, i) => session(`s${i}`, `p_${i}`))
  const saved = buildLayout(sessions, undefined, 0)
  const removed = buildLayout(sessions.slice(1), saved, 1)
  const pruned = buildLayout(sessions.slice(1), removed, 86400001)
  const grown = buildLayout(
    [
      ...sessions.slice(1),
      session('new', 'p_new'),
      ...Array.from({ length: 30 }, (_, i) => session(`busy${i}`, 'p_3'))
    ],
    pruned,
    86400002
  )
  const company = grown.floors[0].zones[0]
  for (const project of company.children) {
    expect(Math.abs(project.x - company.x) + project.width / 2).toBeLessThanOrEqual(
      company.width / 2
    )
    expect(Math.abs(project.z - company.z) + project.depth / 2).toBeLessThanOrEqual(
      company.depth / 2
    )
  }
})

it('keeps every company on its side when another company grows', () => {
  // Arrival order c, b, a: the rows do not follow the alphabet.
  let sessions = [inCompany('c', '0')]
  let layout = buildLayout(sessions, undefined, 0)
  for (const company of ['b', 'a']) {
    sessions = [...sessions, inCompany(company, '0')]
    layout = buildLayout(sessions, layout, 1)
  }
  const side = (key: string, map = layout) => {
    const zone = map.floors[0].zones.find((z) => z.companyKey === key)!
    const row = map.floors[0].zones.filter((other) => Math.sign(other.z) === Math.sign(zone.z))
    const place = row.sort((a, b) => a.x - b.x).indexOf(zone)
    return [Math.sign(zone.z), place, zone.index]
  }
  const before = ['c_a', 'c_b', 'c_c'].map((key) => side(key))

  sessions = [...sessions, ...['1', '2', '3', '4'].map((project) => inCompany('a', project))]
  const grown = buildLayout(sessions, layout, 2)
  expect(['c_a', 'c_b', 'c_c'].map((key) => side(key, grown))).toEqual(before)
})

it('stays compact after thirty short sessions have come and gone', () => {
  const lead = session('lead')
  let layout = buildLayout([lead], undefined, 0)
  for (let minute = 1; minute <= 30; minute++) {
    layout = buildLayout([lead, session(`worker${minute}`)], layout, minute * 60_000)
    layout = buildLayout([lead], layout, minute * 60_000 + 30_000)
  }
  layout = buildLayout([lead, session('last')], layout, 31 * 60_000)

  const floor = layout.floors[0]
  expect(liveBays(layout)).toEqual([0, 1])
  expect(Object.keys(layout.reservations).sort()).toEqual(['last', 'lead'])
  expect(floor.zones[0].children[0].depth).toBeLessThanOrEqual(18)
  expect(area(floor)).toBeLessThan(3000)
})

it('loads a map saved with oversized numbers and brings it out compact', () => {
  const office = (bay: number, sessionKey: string) => ({
    id: `company:c_work:project:p_a:office:${bay}`,
    kind: 'office',
    sessionKey,
    bay,
    index: bay,
    x: 6,
    z: 8,
    width: 4,
    depth: 4,
    door: { x: 6, z: 6 },
    slots: []
  })
  const held = (bay: number, releasedAtMs: number | null) => ({
    floorId: 'hq',
    plate: 0,
    bay,
    companyKey: 'c_work',
    projectKey: 'p_a',
    releasedAtMs
  })
  // What the sprawling version wrote: bays 0 and 31, a 24 x 56 m project, a 138 x 186 m floor.
  const saved: LayoutMap = JSON.parse(
    JSON.stringify({
      version: 1,
      floors: [
        {
          id: 'hq',
          label: 'p_a',
          width: 138,
          depth: 186,
          elevator: { id: 'entrance', x: 0, z: 0, heading: 0 },
          rooms: [office(0, 'lead'), office(31, 'last')],
          zones: [
            {
              id: 'company:c_work',
              kind: 'company',
              companyKey: 'c_work',
              index: 0,
              x: 34.5,
              z: 46.5,
              width: 63,
              depth: 87,
              capacity: 4,
              releasedAtMs: null,
              children: [
                {
                  id: 'company:c_work:project:p_a',
                  kind: 'project',
                  companyKey: 'c_work',
                  projectKey: 'p_a',
                  index: 0,
                  x: 18,
                  z: 34,
                  width: 24,
                  depth: 56,
                  capacity: 32,
                  releasedAtMs: null,
                  children: []
                }
              ]
            }
          ]
        }
      ],
      reservations: {
        lead: held(0, null),
        last: held(31, null),
        ...Object.fromEntries(
          Array.from({ length: 30 }, (_, index) => [`worker${index}`, held(index + 1, 60_000)])
        )
      }
    })
  )

  const layout = buildLayout([session('lead'), session('last')], saved, 120_000)
  const floor = layout.floors[0]
  expect(layout.version).toBe(1)
  expect(layout.reservations.lead.bay).toBe(0)
  expect(liveBays(layout)).toEqual([0, 1])
  expect(Object.keys(layout.reservations).sort()).toEqual(['last', 'lead'])
  expect(floor.zones[0].children[0]).toMatchObject({ width: 11, depth: 8, capacity: 4 })
  expect(area(floor.zones[0])).toBeLessThan(63 * 87)
  expect(area(floor)).toBeLessThan(3000)
})

describe('a seeded floor of three companies, eight projects and twelve sessions', () => {
  const SEED: Seed = [
    ['a', '1', 2],
    ['a', '2', 2],
    ['a', '3', 1],
    ['b', '1', 2],
    ['b', '2', 1],
    ['b', '3', 1],
    ['c', '1', 2],
    ['c', '2', 1]
  ]
  const seeded = () => sessionsOf(SEED)
  const floorOf = (layout: LayoutMap) => {
    const floor = layout.floors[0]
    const companies = floor.zones
    const projects = companies.flatMap((company) => company.children)
    const lounges = companies.map((company) => company.lounge!)
    return { floor, companies, projects, lounges }
  }

  it('holds exactly that many companies, projects and session offices', () => {
    const { floor, companies, projects } = floorOf(buildLayout(seeded(), undefined, 0))
    expect([companies.length, projects.length]).toEqual([3, 8])
    expect(floor.rooms.filter((room) => room.kind === 'office')).toHaveLength(12)
  })

  // Offices sized to their desks are a smaller share of a floor whose lanes stay 3 m wide, so
  // the share is measured on the grounds and the floor is held to an area.
  it('uses at least 45% of the grounds and keeps the floor under 3,000 m2', () => {
    const { floor, companies, projects, lounges } = floorOf(buildLayout(seeded(), undefined, 0))
    const used = [...projects, ...lounges].reduce((total, box) => total + area(box), 0)
    const grounds = companies.reduce((total, company) => total + area(company), 0)
    expect(used / grounds).toBeGreaterThanOrEqual(0.45)
    expect(area(floor)).toBeLessThan(3000)
  })

  it('overlaps nothing and keeps every lane at least 3 m wide', () => {
    expectClearLanes(buildLayout(seeded(), undefined, 0))
  })

  it('keeps the lanes clear when one project is busy and the companies are lopsided', () => {
    const worker = (id: number) => ({ id: `${id}`, type: 'worker', activity: 'reading' as const })
    const lopsided = [
      ...seeded(),
      ...Array.from({ length: 30 }, (_, seat) => inCompany('a', '2', `busy${seat}`)),
      ...['4', '5', '6', '7'].map((project) => inCompany('a', project)),
      { ...inCompany('d', '1'), subagents: Array.from({ length: 40 }, (_, id) => worker(id)) }
    ]
    const grown = buildLayout(lopsided, buildLayout(seeded(), undefined, 0), 1)
    expectClearLanes(grown)
    expectClearLanes(buildLayout(seeded(), grown, 2))
  })

  it('gives the same map for the same input', () => {
    const layout = buildLayout(seeded(), undefined, 0)
    expect(buildLayout(seeded(), undefined, 0)).toEqual(layout)
    expect(buildLayout(seeded().reverse(), undefined, 0)).toEqual(layout)
    expect(buildLayout(seeded(), layout, 1)).toEqual(layout)
  })

  it('moves only the project after the one a session joins, and nobody across the street', () => {
    const layout = buildLayout(seeded(), undefined, 0)
    const next = buildLayout([...seeded(), inCompany('b', '2', 'new')], layout, 1)
    const roomOf = (map: LayoutMap, key: string) =>
      map.floors[0].rooms.find((room) => room.sessionKey === key)
    expect(roomOf(next, 'b-2-new')).toBeDefined()
    for (const live of seeded()) {
      // Project b-2 gains a desk column, which pushes b-3 along its shelf by 5 m.
      const shift = live.projectKey === 'p_b_3' ? 5 : 0
      expect(placeInCompany(next, live.key)).toEqual({
        ...placeInCompany(layout, live.key),
        x: placeInCompany(layout, live.key).x + shift
      })
      // Company a has the other side of the street to itself.
      if (live.companyKey === 'c_a')
        expect(roomOf(next, live.key)).toEqual(roomOf(layout, live.key))
    }
  })

  it('gives every company a lounge of at least 6 x 5 m that the path grid reaches', () => {
    const { floor, lounges } = floorOf(buildLayout(seeded(), undefined, 0))
    const grid = officeGrid(floor)
    // Company a has five agents, so its lounge is the first to grow past four seats.
    expect(lounges.map((lounge) => lounge.slots.length)).toEqual([8, 4, 4])
    for (const lounge of lounges) {
      expect(lounge.width).toBeGreaterThanOrEqual(6)
      expect(lounge.depth).toBeGreaterThanOrEqual(5)
      expect(lounge.slots.map((slot) => slot.id)).toEqual(
        lounge.slots.map((_, index) => `lounge_seat_${index}`)
      )
      for (const seat of lounge.slots) {
        expect(seat.heading).toBe(0)
        expect(isInside({ ...seat, width: 0.6, depth: 0.6 }, lounge)).toBe(true)
        expect(findPath(grid, floor.elevator, seat).length).toBeGreaterThan(0)
      }
    }
  })
})
