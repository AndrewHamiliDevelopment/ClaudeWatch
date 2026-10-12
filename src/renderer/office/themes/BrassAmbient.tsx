import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { worldPoint } from '../town/town-ambient'
import { BRASS_CLOCK_TOWER } from './BrassSurroundings'
import type { PlacedLot } from './lot-kit'
import { BRASS } from './palettes'
import { box, cylinder, Parts, turned, type PartSpec } from './parts'
import type { Vector } from './primitives'
import { draw } from './surroundings'
import type { AmbientProps } from './types'

const MAX_GEAR_TOWERS = 8
const GEAR_TURN_RAD_PER_SEC = 0.5
// The clock tower's shaft is its second part; the gears sit three quarters up it, under the clock.
const SHAFT_PART = 1
const GEAR = { up: 0.75, proud: 0.1, radiusPerShaft: 0.27 }

// A gear wheel on a clock tower's face; `turn` points it out of that face.
export interface TowerGear {
  key: string
  at: Vector
  turn: number
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

// Two gears, front and back, on the shaft of every clock tower the town drew.
export function brassGears(placed: readonly PlacedLot[]): TowerGear[] {
  return placed
    .filter((each) => each.design === BRASS_CLOCK_TOWER)
    .sort((a, b) => draw(a.lot.seed, 80) - draw(b.lot.seed, 80))
    .slice(0, MAX_GEAR_TOWERS)
    .flatMap((tower) => {
      const shaft = tower.parts[SHAFT_PART]
      const [x, y, z] = shaft.at
      const height = y - shaft.size[1] / 2 + shaft.size[1] * GEAR.up
      return [1, -1].map(
        (face): TowerGear => ({
          key: `${tower.key}:${face}`,
          at: worldPoint(tower, [x, height, z + face * (shaft.size[2] / 2 + GEAR.proud)]),
          turn: tower.turn,
          radius: shaft.size[0] * GEAR.radiusPerShaft * tower.scale
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
        <group key={gear.key} position={gear.at} rotation={[0, gear.turn, 0]}>
          <Parts parts={gearParts(gear.radius)} />
        </group>
      ))}
    </group>
  )
}

// Gears turning on the clock towers. The town draws the foundry steam (town/TownView).
export function BrassAmbient({ placed = [], isReducedMotion }: AmbientProps) {
  const gears = useMemo(() => brassGears(placed), [placed])
  return <TowerGears gears={gears} isReducedMotion={isReducedMotion} />
}
