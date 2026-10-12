import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Object3D } from 'three'
import type { FloorGeometry } from '../scene-model'
import { RisingSteam, steamStacksOn, type SteamStack } from './ambient-parts'
import {
  BRASS_BUILDINGS,
  BRASS_CLOCK_TOWER,
  BRASS_FOUNDRY,
  BRASS_STEAM_RISE_M,
  brassGearOf,
  brassStacksOf
} from './BrassSurroundings'
import { designFor, lotBase, plotOf, seeded } from './lot-parts'
import { BRASS } from './palettes'
import { box, cylinder, Parts, turned, type PartSpec } from './parts'
import type { Vector } from './primitives'
import type { Lot } from './surroundings'
import type { AmbientProps } from './types'

type Plate = Pick<FloorGeometry, 'width' | 'depth'>

const MAX_GEAR_TOWERS = 8
const GEAR_TURN_RAD_PER_SEC = 0.5

// A gear wheel on a clock tower's face.
export interface TowerGear {
  key: string
  at: Vector
  radius: number
}

function gearParts(radius: number): PartSpec[] {
  return [
    turned(cylinder([0, 0, 0], [radius * 2, 0.1, radius * 2], BRASS.brass), [Math.PI / 2, 0, 0]),
    ...[0, 1, 2].map((tooth) =>
      turned(box([0, 0, 0], [radius * 2.4, 0.18, 0.1], BRASS.brass), [0, 0, (tooth * Math.PI) / 3])
    )
  ]
}

export function brassGears(lots: readonly Lot[], floor: Plate): TowerGear[] {
  return lots
    .filter((lot) => lot.kind === 'building')
    .map((lot) => ({ lot, base: lotBase(lot, floor) }))
    .filter(
      ({ lot, base }) => designFor(BRASS_BUILDINGS, plotOf(lot, base)).name === BRASS_CLOCK_TOWER
    )
    .sort((a, b) => seeded(a.lot.seed, 80) - seeded(b.lot.seed, 80))
    .slice(0, MAX_GEAR_TOWERS)
    .flatMap(({ lot, base }) => {
      const gear = brassGearOf(plotOf(lot, base))
      return [1, -1].map(
        (face): TowerGear => ({
          key: `${lot.id}:${face}`,
          at: [lot.x, base + gear.y, lot.z + face * gear.z],
          radius: gear.radius
        })
      )
    })
}

// Alternate children turn opposite ways: the two faces of one tower.
export function turnGears(root: Object3D, timeSec: number): void {
  root.children.forEach((child, index) => {
    child.rotation.z = (index % 2 ? -1 : 1) * timeSec * GEAR_TURN_RAD_PER_SEC
  })
}

export function brassSteamStacks(lots: readonly Lot[], floor: Plate): SteamStack[] {
  return steamStacksOn(
    lots,
    floor,
    BRASS_BUILDINGS,
    BRASS_FOUNDRY,
    brassStacksOf,
    BRASS_STEAM_RISE_M
  )
}

function TowerGears({
  gears,
  isReducedMotion
}: { gears: readonly TowerGear[] } & Pick<AmbientProps, 'isReducedMotion'>) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!isReducedMotion && root.current) turnGears(root.current, clock.elapsedTime)
  })
  return (
    <group ref={root}>
      {gears.map((gear) => (
        <group key={gear.key} position={gear.at}>
          <Parts parts={gearParts(gear.radius)} />
        </group>
      ))}
    </group>
  )
}

// Gears turning on the clock towers and steam off the foundry stacks.
export function BrassAmbient({ floor, lots, isReducedMotion }: AmbientProps) {
  const gears = useMemo(() => brassGears(lots, floor), [lots, floor])
  const stacks = useMemo(() => brassSteamStacks(lots, floor), [lots, floor])
  return (
    <>
      <TowerGears gears={gears} isReducedMotion={isReducedMotion} />
      <RisingSteam stacks={stacks} color={BRASS.steam} isReducedMotion={isReducedMotion} />
    </>
  )
}
