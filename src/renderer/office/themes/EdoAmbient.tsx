import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { RisingSteam, steamStacksOn, type SteamStack } from './ambient-parts'
import { EDO_BATHHOUSE, EDO_BUILDINGS, EDO_STEAM_RISE_M, edoStackOf } from './EdoSurroundings'
import { clamp } from '../../../shared/range'
import { EDO } from './palettes'
import { box, lit, Parts, type PartSpec } from './parts'
import type { Vector } from './primitives'
import type { Rect } from './lot-math'
import { draw, lotBase, type Lot } from './surroundings'
import type { AmbientProps } from './types'

const MAX_DRONES = 10
const DRONE = { speed: 0.6, street: 0.4, bob: 0.12, halfHeight: 0.3 }
const DRONE_PARTS: readonly PartSpec[] = [
  lit(box([0, 0, 0], [0.3, 0.4, 0.3], EDO.glow)),
  box([0, 0.23, 0], [0.36, 0.06, 0.36], EDO.ink),
  box([0, -0.23, 0], [0.36, 0.06, 0.36], EDO.ink)
]

// A paper lantern that carries itself round the streets of one lot.
export interface LanternDrone {
  lotId: string
  x: number
  z: number
  halfWidth: number
  halfDepth: number
  y: number
  // Where on its round it starts, 0 to 1.
  start: number
}

export function lanternDrones(lots: readonly Lot[], floor: Rect): LanternDrone[] {
  return lots
    .filter((lot) => lot.kind === 'building')
    .sort((a, b) => draw(a.seed, 60) - draw(b.seed, 60))
    .slice(0, MAX_DRONES)
    .map((lot) => {
      const base = lotBase(lot, floor)
      return {
        lotId: lot.id,
        x: lot.x,
        z: lot.z,
        halfWidth: lot.width / 2 + DRONE.street,
        halfDepth: lot.depth / 2 + DRONE.street,
        y: base + clamp(lot.maxHeight - base - 0.9, [0.9, 2.6]),
        start: draw(lot.seed, 61)
      }
    })
}

// Round the lot's edge at walking pace, bobbing a little.
export function dronePosition(drone: LanternDrone, timeSec: number): Vector {
  const { halfWidth, halfDepth } = drone
  const round = 4 * (halfWidth + halfDepth)
  let walked = (((timeSec * DRONE.speed) / round + drone.start) % 1) * round
  const y = drone.y + DRONE.bob * Math.sin(timeSec * 0.9 + drone.start * 6)
  if (walked < 2 * halfWidth) return [drone.x - halfWidth + walked, y, drone.z + halfDepth]
  walked -= 2 * halfWidth
  if (walked < 2 * halfDepth) return [drone.x + halfWidth, y, drone.z + halfDepth - walked]
  walked -= 2 * halfDepth
  if (walked < 2 * halfWidth) return [drone.x + halfWidth - walked, y, drone.z - halfDepth]
  return [drone.x - halfWidth, y, drone.z - halfDepth + (walked - 2 * halfWidth)]
}

function moveDrones(root: Object3D, drones: readonly LanternDrone[], timeSec: number): void {
  root.children.forEach((child, index) => {
    const drone = drones[index]
    if (drone) child.position.set(...dronePosition(drone, timeSec))
  })
}

export function edoSteamStacks(lots: readonly Lot[], floor: Rect): SteamStack[] {
  return steamStacksOn(
    lots,
    floor,
    EDO_BUILDINGS,
    EDO_BATHHOUSE,
    (plot) => [edoStackOf(plot)],
    EDO_STEAM_RISE_M
  )
}

function LanternDrones({ drones, isReducedMotion }: { drones: readonly LanternDrone[] } & Still) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!isReducedMotion && root.current) moveDrones(root.current, drones, clock.elapsedTime)
  })
  return (
    <group ref={root}>
      {drones.map((drone) => (
        <group key={drone.lotId} position={dronePosition(drone, 0)}>
          <Parts parts={DRONE_PARTS} />
        </group>
      ))}
    </group>
  )
}

type Still = Pick<AmbientProps, 'isReducedMotion'>

// Lantern drones on their rounds and steam off the bathhouse chimneys.
export function EdoAmbient({ floor, lots, isReducedMotion }: AmbientProps) {
  const drones = useMemo(() => lanternDrones(lots, floor), [lots, floor])
  const stacks = useMemo(() => edoSteamStacks(lots, floor), [lots, floor])
  return (
    <>
      <LanternDrones drones={drones} isReducedMotion={isReducedMotion} />
      <RisingSteam stacks={stacks} color={EDO.steam} isReducedMotion={isReducedMotion} />
    </>
  )
}
