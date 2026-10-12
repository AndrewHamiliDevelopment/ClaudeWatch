import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Group, Texture } from 'three'
import { groupZonesByTheme } from '../../logic/office-themes'
import type { FloorGeometry } from '../../scene-model'
import { FloorView } from '../../scene/FloorView'
import { SurroundingsView, WorldView } from '../../scene/WorldView'
import { registerTheme } from '../registry'
import { mergedDraws } from '../scene.test-utils'
import { surroundingLots, WORLD_APRON } from '../surroundings'
import type { OfficeTheme } from '../types'
import { CIRCUIT_ALTITUDE_M, circuitPose, radarMounts } from './ambient'
import { DISH_REACH_M } from './buildings'
import { RadarDish, Shuttle } from './GarrisonAmbient'
import { orbitalGarrison } from './index'
import { buildLot } from './lots'
import { FLOORS, officeGap } from './yard.test-utils'

type Frame = (state: { clock: { elapsedTime: number }; invalidate: () => void }) => void
const frames: Frame[] = []
const refs: { current: Group }[] = []

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  // A mounted group for every ref, so a frame callback has something to move.
  useRef: (current: object | null) => {
    const ref = { current: current ?? new Group() }
    if (ref.current instanceof Group) refs.push({ current: ref.current })
    return ref
  }
}))
vi.mock('@react-three/fiber', () => ({ useFrame: (frame: Frame) => frames.push(frame) }))
vi.mock('../../scene/textures', () => ({ signTexture: () => new Texture() }))

// The whole theme may add this many draws across its surroundings, lounge and ambient parts.
const DRAW_BUDGET = 9
// What the district, the hangar and the tower cost before the apron was filled.
const WORLD_DRAWS_BEFORE = 19
const WIDE = FLOORS[2]

const withoutLounge: OfficeTheme = {
  ...orbitalGarrison,
  id: 'test-garrison-no-lounge',
  kit: { ...orbitalGarrison.kit, zone: { ...orbitalGarrison.kit.zone, Lounge: undefined } }
}
registerTheme(withoutLounge)

function floorDraws(floor: FloorGeometry, theme: OfficeTheme): number {
  return mergedDraws(
    createElement(FloorView, {
      floor,
      floorTheme: theme,
      zoneGroups: groupZonesByTheme(floor, () => theme.id),
      wallsMode: 'cutaway',
      isReducedMotion: true
    })
  ).draws
}

// Renders one mover, then runs the frame callback it registered against the group it holds.
function moved(render: () => unknown, seconds: number) {
  render()
  const group = refs.at(-1)?.current
  const frame = frames.at(-1)
  if (!group || !frame) throw new Error('The mover registered no frame callback')
  const invalidate = vi.fn()
  const before = [group.rotation.y, group.position.x, group.position.z]
  frame({ clock: { elapsedTime: seconds }, invalidate })
  frame({ clock: { elapsedTime: seconds + 2 }, invalidate })
  const after = [group.rotation.y, group.position.x, group.position.z]
  return { hasMoved: after.some((value, index) => value !== before[index]), invalidate }
}

describe('the Orbital Garrison draw budget', () => {
  it('registers surroundings, a lounge and ambient movers on its zone kit', () => {
    const { Surroundings, Lounge, Ambient } = orbitalGarrison.kit.zone
    expect([Surroundings, Lounge, Ambient].every((part) => part !== undefined)).toBe(true)
  })

  it.each(FLOORS.map((floor) => [`${floor.width} x ${floor.depth}`, floor] as const))(
    'adds at most nine draws on a %s m floor',
    (size, floor) => {
      const lots = surroundingLots(floor)
      const surroundings = mergedDraws(
        createElement(SurroundingsView, {
          floor,
          floorTheme: orbitalGarrison,
          zoneGroups: groupZonesByTheme(floor, () => orbitalGarrison.id),
          lots,
          isReducedMotion: false
        })
      )
      const lounge = floorDraws(floor, orbitalGarrison) - floorDraws(floor, withoutLounge)
      console.info(
        `garrison ${size}: ${surroundings.draws} surroundings + ambient, ${lounge} lounge, ${surroundings.triangles} triangles on ${lots.length} lots`
      )
      expect(surroundings.draws).toBeGreaterThan(0)
      expect(lounge).toBeGreaterThanOrEqual(0)
      expect(surroundings.draws + lounge).toBeLessThanOrEqual(DRAW_BUDGET)
      expect(surroundings.triangles).toBeLessThan(150_000)
    }
  )

  it('fills the apron without a new draw in the district', () => {
    const world = mergedDraws(
      createElement(WorldView, {
        floor: WIDE,
        theme: orbitalGarrison,
        band: 'building',
        floors: [{ floorId: WIDE.floorId, label: WIDE.label, agentCount: 60, attentionCount: 1 }]
      })
    )
    console.info(`garrison world: ${world.draws} draws, ${world.triangles} triangles`)
    expect(world.draws).toBeLessThanOrEqual(WORLD_DRAWS_BEFORE)
  })
})

describe('what moves around the garrison', () => {
  it('mounts a dish on every radar tower it draws, up to eight', () => {
    for (const floor of FLOORS) {
      const lots = surroundingLots(floor)
      const mounts = radarMounts(lots, floor)
      const towers = lots.filter((lot) => buildLot(lot, 0).designId === 'radar-tower')
      expect(mounts.length).toBe(Math.min(8, towers.length))
      expect(mounts.length).toBeGreaterThan(0)
      for (const mount of mounts) {
        const lot = lots.find((each) => each.x === mount.x && each.z === mount.z)
        expect(mount.y + DISH_REACH_M * mount.scale).toBeLessThanOrEqual(lot?.maxHeight ?? 0)
      }
    }
  })

  it('flies the shuttle a circuit north of the plate, clear of every desk', () => {
    for (const floor of FLOORS) {
      const poses = Array.from({ length: 200 }, (_, step) => circuitPose(floor, step / 200))
      for (const pose of poses) {
        const north = floor.z - floor.depth / 2
        expect(pose.z).toBeLessThan(north - 3)
        expect(pose.z).toBeGreaterThan(north - WORLD_APRON.north)
        expect(Math.abs(pose.x - floor.x)).toBeLessThan(floor.width / 2)
        const gap = officeGap(floor, { x: pose.x, z: pose.z, width: 2, depth: 2 })
        expect(CIRCUIT_ALTITUDE_M + 0.5).toBeLessThanOrEqual(gap * 0.7)
      }
      expect(new Set(poses.map((pose) => pose.x.toFixed(1))).size).toBeGreaterThan(50)
    }
  })

  it('turns the dish and flies the shuttle, and never asks for a frame', () => {
    const mount = { x: 4, y: 6, z: 2, scale: 1 }
    for (const mover of [
      moved(() => RadarDish({ mount, isReducedMotion: false }), 3),
      moved(() => Shuttle({ floor: WIDE, isReducedMotion: false }), 3)
    ]) {
      expect(mover.hasMoved).toBe(true)
      expect(mover.invalidate).not.toHaveBeenCalled()
    }
  })

  it('holds both still under reduced motion', () => {
    const mount = { x: 4, y: 6, z: 2, scale: 1 }
    expect(moved(() => RadarDish({ mount, isReducedMotion: true }), 3).hasMoved).toBe(false)
    expect(moved(() => Shuttle({ floor: WIDE, isReducedMotion: true }), 3).hasMoved).toBe(false)
  })
})
