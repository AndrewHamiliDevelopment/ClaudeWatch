import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { drawnTop } from '../town/town-ambient'
import type { PlacedLot } from './lot-kit'
import { EDO } from './palettes'
import { box, lit, Parts, type PartSpec } from './parts'
import type { Vector } from './primitives'
import { draw } from './surroundings'
import type { AmbientProps } from './types'

const MAX_DRONES = 10
// A drone rounds its lot just inside the edge, and flies a gap above the roof drawn there.
const DRONE = { speed: 0.6, inset: 0.3, bob: 0.12, halfHeight: 0.3, overRoof: 0.3 }
const DRONE_PARTS: readonly PartSpec[] = [
  lit(box([0, 0, 0], [0.3, 0.4, 0.3], EDO.glow)),
  box([0, 0.23, 0], [0.36, 0.06, 0.36], EDO.ink),
  box([0, -0.23, 0], [0.36, 0.06, 0.36], EDO.ink)
]

// A paper lantern that carries itself round one lot, above its roof.
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

export function lanternDrones(placed: readonly PlacedLot[]): LanternDrone[] {
  return placed
    .filter(({ lot }) => lot.kind === 'building')
    .sort((a, b) => draw(a.lot.seed, 60) - draw(b.lot.seed, 60))
    .flatMap((each): LanternDrone[] => {
      const { lot } = each
      const y = drawnTop(each) + DRONE.overRoof + DRONE.bob + DRONE.halfHeight
      if (y + DRONE.bob + DRONE.halfHeight > lot.maxHeight) return []
      return [
        {
          lotId: lot.id,
          x: lot.x,
          z: lot.z,
          halfWidth: lot.width / 2 - DRONE.inset,
          halfDepth: lot.depth / 2 - DRONE.inset,
          y,
          start: draw(lot.seed, 61)
        }
      ]
    })
    .slice(0, MAX_DRONES)
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

// Lantern drones on their rounds over the roofs. The town draws the steam (town/TownView).
export function EdoAmbient({ placed = [], isReducedMotion }: AmbientProps) {
  const drones = useMemo(() => lanternDrones(placed), [placed])
  return <LanternDrones drones={drones} isReducedMotion={isReducedMotion} />
}
