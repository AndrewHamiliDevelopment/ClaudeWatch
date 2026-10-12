import { expect, it } from 'vitest'
import { makeFloor, makeRoom, makeZone } from '../__tests__/fixtures'
import { groupZonesByTheme } from './office-themes'

function company(companyKey: string, projectKeys: readonly string[]) {
  return makeZone({
    id: companyKey,
    kind: 'company',
    companyKey,
    children: projectKeys.map((projectKey) =>
      makeZone({
        id: projectKey,
        kind: 'project',
        companyKey,
        projectKey,
        children: [
          makeZone({ id: `${projectKey}:office:0`, kind: 'office', companyKey, projectKey })
        ]
      })
    )
  })
}

const floor = makeFloor({
  floorId: 'hq',
  zones: [company('c_a', ['p_a1', 'p_a2']), company('c_b', ['p_b1'])],
  rooms: ['p_a1', 'p_a2', 'p_b1'].map((projectKey) => makeRoom({ id: `${projectKey}:office:0` }))
})

it('puts every company, project and room in exactly one theme group', () => {
  const groups = groupZonesByTheme(floor, (zone) =>
    zone.projectKey === 'p_a2' ? 'override' : zone.companyKey === 'c_a' ? 'company-a' : 'default'
  )
  expect(
    groups.map((group) => ({
      themeId: group.themeId,
      companies: group.companies.map((zone) => zone.id),
      projects: group.projects.map((zone) => zone.id),
      rooms: group.rooms.map((room) => room.id)
    }))
  ).toEqual([
    { themeId: 'company-a', companies: ['c_a'], projects: ['p_a1'], rooms: ['p_a1:office:0'] },
    { themeId: 'override', companies: [], projects: ['p_a2'], rooms: ['p_a2:office:0'] },
    { themeId: 'default', companies: ['c_b'], projects: ['p_b1'], rooms: ['p_b1:office:0'] }
  ])
})

it('gives a room outside every project zone the theme of an unassigned zone', () => {
  const stray = makeRoom({ id: 'stray' })
  const groups = groupZonesByTheme({ ...floor, rooms: [...floor.rooms, stray] }, (zone) =>
    zone.companyKey === null ? 'default' : 'company'
  )
  expect(groups.find((group) => group.themeId === 'default')?.rooms).toEqual([stray])
  expect(groups.flatMap((group) => group.rooms)).toHaveLength(4)
})

it('makes a single group when one theme covers the floor', () => {
  const groups = groupZonesByTheme(floor, () => 'only')
  expect(groups).toHaveLength(1)
  expect(groups[0].rooms).toEqual(floor.rooms)
})
