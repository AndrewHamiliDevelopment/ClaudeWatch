import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { FloorGeometry } from '../../scene-model'
import { box, lit, Parts, turned, type PartSpec, cone } from '../parts'
import type { Vector } from '../primitives'
import { lotBase, type Lot } from '../surroundings'
import type { AmbientProps, SurroundingsProps } from '../types'
import { COURT_LOT_KIT } from './court-lots'
import { spread } from '../lot-kit'
import { KitFill } from '../LotFill'
import { COURT } from './palette'

// The palace-and-academy city on this theme's lots.
export function CourtSurroundings({ floor, lots }: SurroundingsProps) {
  return <KitFill lots={lots} floor={floor} kit={COURT_LOT_KIT} />
}

const BANNER_LIMIT = 16
const MAST = { minRoom: 3, maxHeight: 4.5, inset: 0.1 }
const SWAY = { perSecond: 1.3, turn: 0.35 }
const PATROL_LIMIT = 3
const PATROL = { headroom: 0.35, turnPerSecond: 0.5, scale: 0.5 }

interface Mast {
  id: string
  foot: Vector
  height: number
}

// A mast on the corner of every few buildings that have the height for one.
function bannerMasts(lots: readonly Lot[], floor: FloorGeometry): Mast[] {
  const tall = lots.flatMap((lot) => {
    const base = lotBase(lot, floor)
    const room = lot.maxHeight - base
    if (lot.kind !== 'building' || room < MAST.minRoom) return []
    const foot: Vector = [
      lot.x - lot.width / 2 + MAST.inset,
      base,
      lot.z + lot.depth / 2 - MAST.inset
    ]
    return [{ id: lot.id, foot, height: Math.min(room, MAST.maxHeight) }]
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

// The tallest lots: a skiff circles each at its footprint's edge, just under its height limit.
function patrolOrbits(lots: readonly Lot[]): Lot[] {
  return lots
    .filter((lot) => lot.kind === 'building')
    .sort((a, b) => b.maxHeight - a.maxHeight || a.id.localeCompare(b.id))
    .slice(0, PATROL_LIMIT)
}

function patrolPose(lot: Lot, index: number, time: number) {
  const angle = index * 2 + time * PATROL.turnPerSecond
  const radius = Math.min(lot.width, lot.depth) / 2
  const at: Vector = [
    lot.x + Math.cos(angle) * radius,
    lot.maxHeight - PATROL.headroom,
    lot.z + Math.sin(angle) * radius
  ]
  return { at, heading: -angle }
}

// Banners that sway on their masts and skiffs that circle the tallest towers.
export function CourtAmbient({ floor, lots, isReducedMotion }: AmbientProps) {
  const banners = useRef<(Group | null)[]>([])
  const skiffs = useRef<(Group | null)[]>([])
  const masts = useMemo(() => bannerMasts(lots, floor), [lots, floor])
  const orbits = useMemo(() => patrolOrbits(lots), [lots])
  useFrame(({ clock }) => {
    if (isReducedMotion) return
    const time = clock.elapsedTime
    banners.current.forEach((banner, index) => {
      if (banner) banner.rotation.y = Math.sin(time * SWAY.perSecond + index) * SWAY.turn
    })
    skiffs.current.forEach((skiff, index) => {
      const lot = orbits[index]
      if (!skiff || !lot) return
      const pose = patrolPose(lot, index, time)
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
      {orbits.map((lot, index) => {
        const rest = patrolPose(lot, index, 0)
        return (
          <group
            key={lot.id}
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
