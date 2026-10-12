import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { box, lit, Parts, turned, type PartSpec, cone } from '../parts'
import type { Vector } from '../primitives'
import { drawnTop } from '../../town/town-ambient'
import type { Lot } from '../surroundings'
import type { AmbientProps, SurroundingsProps } from '../types'
import { COURT_LOT_KIT } from './court-lots'
import { spread, type PlacedLot } from '../lot-kit'
import { KitFill } from '../LotFill'
import { COURT } from './palette'

// The palace-and-academy city on this theme's lots.
export function CourtSurroundings({ floor, lots }: SurroundingsProps) {
  return <KitFill lots={lots} floor={floor} kit={COURT_LOT_KIT} />
}

const BANNER_LIMIT = 16
const MAST = { minRoom: 1.5, maxHeight: 2.5 }
const SWAY = { perSecond: 1.3, turn: 0.35 }
const PATROL_LIMIT = 3
const PATROL = { headroom: 0.35, overRoof: 0.6, turnPerSecond: 0.5, scale: 0.5 }

interface Mast {
  id: string
  foot: Vector
  height: number
}

// A mast on the roof of every few buildings that have the room above them for one.
export function bannerMasts(placed: readonly PlacedLot[]): Mast[] {
  const tall = placed.flatMap((each) => {
    const { lot } = each
    const top = drawnTop(each)
    const room = lot.maxHeight - top
    if (lot.kind !== 'building' || room < MAST.minRoom) return []
    return [
      { id: lot.id, foot: [lot.x, top, lot.z] as Vector, height: Math.min(room, MAST.maxHeight) }
    ]
  })
  return spread(tall, BANNER_LIMIT)
}

const mastParts = (height: number): PartSpec[] => [
  box([0, height / 2, 0], [0.08, height, 0.08], COURT.ink),
  box([0, height - 0.03, 0], [0.16, 0.06, 0.16], COURT.gold)
]
// Hung from the mast, so it swings about the mast and not about its own middle.
const CLOTH: PartSpec[] = [
  box([0.5, -0.12, 0], [1, 0.05, 0.05], COURT.gold),
  box([0.5, -0.68, 0], [0.84, 1.1, 0.03], COURT.violet),
  box([0.5, -0.68, 0.02], [0.2, 0.5, 0.02], COURT.gold)
]

// A patrol skiff, nose toward +z.
const SKIFF: PartSpec[] = [
  box([0, 0, 0], [0.7, 0.4, 2.2], COURT.ink),
  box([0, 0.05, -0.2], [2, 0.06, 0.6], COURT.gold),
  box([0, 0.42, -0.75], [0.08, 0.5, 0.7], COURT.violet),
  lit(box([0, -0.22, 0.7], [0.3, 0.1, 0.3], COURT.lumen)),
  turned(cone([0, 0, 1.34], [0.4, 0.5, 0.4], COURT.gold), [Math.PI / 2, 0, 0])
]

interface Orbit {
  lot: Lot
  y: number
}

// The tallest buildings with air above them: a skiff circles each over its roof, under its limit.
export function patrolOrbits(placed: readonly PlacedLot[]): Orbit[] {
  return placed
    .filter(({ lot }) => lot.kind === 'building')
    .flatMap((each): (Orbit & { top: number })[] => {
      const top = drawnTop(each)
      const y = each.lot.maxHeight - PATROL.headroom
      return y - top > PATROL.overRoof ? [{ lot: each.lot, y, top }] : []
    })
    .sort((a, b) => b.top - a.top || a.lot.id.localeCompare(b.lot.id))
    .slice(0, PATROL_LIMIT)
    .map(({ lot, y }) => ({ lot, y }))
}

function patrolPose({ lot, y }: Orbit, index: number, time: number) {
  const angle = index * 2 + time * PATROL.turnPerSecond
  const radius = Math.min(lot.width, lot.depth) / 2
  const at: Vector = [lot.x + Math.cos(angle) * radius, y, lot.z + Math.sin(angle) * radius]
  return { at, heading: -angle }
}

// Banners that sway on their masts and skiffs that circle the tallest towers.
export function CourtAmbient({ placed = [], isReducedMotion }: AmbientProps) {
  const banners = useRef<(Group | null)[]>([])
  const skiffs = useRef<(Group | null)[]>([])
  const masts = useMemo(() => bannerMasts(placed), [placed])
  const orbits = useMemo(() => patrolOrbits(placed), [placed])
  useFrame(({ clock }) => {
    if (isReducedMotion) return
    const time = clock.elapsedTime
    banners.current.forEach((banner, index) => {
      if (banner) banner.rotation.y = Math.sin(time * SWAY.perSecond + index) * SWAY.turn
    })
    skiffs.current.forEach((skiff, index) => {
      const orbit = orbits[index]
      if (!skiff || !orbit) return
      const pose = patrolPose(orbit, index, time)
      skiff.position.set(...pose.at)
      skiff.rotation.y = pose.heading
    })
  })
  return (
    <group>
      {masts.map((mast, index) => (
        <group key={mast.id} position={mast.foot}>
          <Parts parts={mastParts(mast.height)} />
          <group
            name="ambient-banner"
            position={[0, mast.height, 0]}
            ref={(node) => {
              banners.current[index] = node
            }}
          >
            <Parts parts={CLOTH} />
          </group>
        </group>
      ))}
      {orbits.map((orbit, index) => {
        const rest = patrolPose(orbit, index, 0)
        return (
          <group
            key={orbit.lot.id}
            name="ambient-patrol"
            position={rest.at}
            rotation={[0, rest.heading, 0]}
            scale={PATROL.scale}
            ref={(node) => {
              skiffs.current[index] = node
            }}
          >
            <Parts parts={SKIFF} />
          </group>
        )
      })}
    </group>
  )
}
