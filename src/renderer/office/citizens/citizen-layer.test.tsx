import { describe, expect, it, vi } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { groupZonesByTheme } from '../logic/office-themes'
import { districtLots } from '../player/district-lots'
import type { FloorGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { getTheme, listThemes } from '../themes/registry'
import { everyElement, mergedDraws } from '../themes/scene.test-utils'
import { surroundingLots } from '../themes/surroundings'
import { CitizenLayer } from './CitizenLayer'
import { MAX_CITIZEN_DRAWS } from './town'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useLayoutEffect: () => {}
}))
vi.mock('@react-three/fiber', () => ({ useFrame: () => {} }))

const themes = listThemes()
const edo = getTheme('neo-edo-steam')

// Each company on its own theme, in the registry's order.
function layerOn(floor: FloorGeometry) {
  const companyKeys = floor.zones.map((zone) => zone.companyKey)
  const zoneGroups = groupZonesByTheme(
    floor,
    (zone) => themes[Math.max(0, companyKeys.indexOf(zone.companyKey)) % themes.length].id
  )
  return (
    <CitizenLayer
      floor={floor}
      solids={[...surroundingLots(floor), ...districtLots(edo.id, floor)]}
      floorTheme={edo}
      zoneGroups={zoneGroups}
      player={null}
      isReducedMotion={false}
    />
  )
}

const FLOORS: readonly (readonly [string, FloorGeometry])[] = [
  ['the seeded floor', buildFixtureFrame(0, 0).floors[0]],
  ...LIVE_FLOORS
]

describe.each(FLOORS)('CitizenLayer on %s', (_name, floor) => {
  const layer = layerOn(floor)

  it('adds no more than six draws for every citizen in town', () => {
    const { draws } = mergedDraws(layer)
    expect(draws).toBeGreaterThan(0)
    expect(draws).toBeLessThanOrEqual(MAX_CITIZEN_DRAWS)
  })

  it('draws them instanced, with nothing to click and nothing that marks a worker', () => {
    const drawn = everyElement(layer)
    const meshes = drawn.filter((element) => element.type === 'instancedMesh')
    expect(meshes.length).toBeGreaterThan(0)
    for (const mesh of meshes)
      expect(Object.keys(mesh.props).filter((prop) => prop.startsWith('on'))).toEqual([])
    // Geometry and material only: no card, gem, desk or overlay rides along.
    const others = drawn
      .map((element) => element.type)
      .filter((type) => typeof type === 'string' && type !== 'instancedMesh')
    expect(new Set(others)).toEqual(new Set(['meshStandardMaterial']))
  })
})
