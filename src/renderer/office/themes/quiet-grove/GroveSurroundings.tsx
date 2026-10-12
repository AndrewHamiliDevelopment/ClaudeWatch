import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { lit, Parts, type PartSpec, sphere } from '../parts'
import type { Vector } from '../primitives'
import { drawnTop } from '../../town/town-ambient'
import { draw } from '../surroundings'
import type { AmbientProps, SurroundingsProps } from '../types'
import { spread, type PlacedLot } from '../lot-kit'
import { KitFill } from '../LotFill'
import { GROVE_LOT_KIT } from './grove-lots'
import { GROVE } from './palette'

// The forest around the clearing on this theme's lots.
export function GroveSurroundings({ floor, lots }: SurroundingsProps) {
  return <KitFill lots={lots} floor={floor} kit={GROVE_LOT_KIT} />
}

const FIREFLY_LIMIT = 28
const FIREFLY = { overRoof: 0.6, headroom: 0.4, bob: 0.25, turnPerSecond: 0.7 }
const LEAF_LIMIT = 24
const LEAF = { fall: 3, minFall: 1, headroom: 0.3, drift: 0.6, spinPerSecond: 1.5 }
// Draws 0 to 6 of a lot's seed are spent on its place and its design.
const DRAW = { phase: 7, pace: 8 }

const FIREFLY_PARTS: PartSpec[] = [lit(sphere([0, 0, 0], [0.16, 0.16, 0.16], GROVE.lumen))]
const LEAF_PARTS: PartSpec[] = [sphere([0, 0, 0], [0.32, 0.04, 0.2], GROVE.moss)]

interface Mover {
  id: string
  // Where it hovers, or the top of its fall.
  home: Vector
  // How far it strays sideways, and for a leaf how far it falls.
  reach: number
  fall: number
  phase: number
  pace: number
}

// Over what the town drew on the lot, `rise` above its top, or nothing when the lot's limit is
// too close above the roof for it.
function moverOver(placed: PlacedLot, rise: number, headroom: number, least: number): Mover[] {
  const { lot } = placed
  const top = drawnTop(placed)
  const y = Math.min(lot.maxHeight - headroom, top + rise)
  if (y - top < least) return []
  return [
    {
      id: lot.id,
      home: [lot.x, y, lot.z],
      reach: Math.min(lot.width, lot.depth) / 2,
      fall: y - top,
      phase: draw(lot.seed, DRAW.phase),
      pace: 0.7 + draw(lot.seed, DRAW.pace) * 0.6
    }
  ]
}

// Fireflies loop just above the roofs and treetops; the bob stays inside the room left.
export function fireflyMovers(placed: readonly PlacedLot[]): Mover[] {
  const hovering = placed.flatMap((each) =>
    moverOver(
      each,
      FIREFLY.overRoof + FIREFLY.bob,
      FIREFLY.headroom,
      FIREFLY.overRoof + FIREFLY.bob
    )
  )
  return spread(hovering, FIREFLY_LIMIT).map((mover) => ({ ...mover, fall: FIREFLY.bob }))
}

// Leaves drift down onto the roofs of the buildings, never through them.
export function leafMovers(placed: readonly PlacedLot[]): Mover[] {
  const falling = placed
    .filter(({ lot }) => lot.kind === 'building')
    .flatMap((each) => moverOver(each, LEAF.fall, LEAF.headroom, LEAF.minFall))
  return spread(falling, LEAF_LIMIT)
}

// A slow loop around its lot, bobbing as it goes.
function fireflyAt({ home, reach, phase, pace }: Mover, time: number): Vector {
  const turn = phase * Math.PI * 2 + time * FIREFLY.turnPerSecond * pace
  const radius = Math.min(reach, 0.9)
  return [
    home[0] + Math.cos(turn) * radius,
    home[1] + Math.sin(turn * 1.7) * FIREFLY.bob,
    home[2] + Math.sin(turn * 1.3) * radius
  ]
}

// Down from the canopy to the ground, then again from the top.
function leafAt({ home, reach, fall, phase, pace }: Mover, time: number): Vector {
  const fallen = (phase + (time * pace) / 8) % 1
  const sway = Math.sin((phase + fallen) * Math.PI * 4) * Math.min(reach, LEAF.drift)
  return [home[0] + sway, home[1] - fallen * fall, home[2] + reach * (phase - 0.5)]
}

// Fireflies that loop over the lots and leaves that fall from the trees.
export function GroveAmbient({ placed = [], isReducedMotion }: AmbientProps) {
  const fireflies = useRef<(Group | null)[]>([])
  const leaves = useRef<(Group | null)[]>([])
  const hovering = useMemo(() => fireflyMovers(placed), [placed])
  const falling = useMemo(() => leafMovers(placed), [placed])
  useFrame(({ clock }) => {
    if (isReducedMotion) return
    const time = clock.elapsedTime
    fireflies.current.forEach((firefly, index) => {
      if (firefly && hovering[index]) firefly.position.set(...fireflyAt(hovering[index], time))
    })
    leaves.current.forEach((leaf, index) => {
      if (!leaf || !falling[index]) return
      leaf.position.set(...leafAt(falling[index], time))
      leaf.rotation.y = time * LEAF.spinPerSecond + index
    })
  })
  return (
    <group>
      {hovering.map((mover, index) => (
        <group
          key={mover.id}
          name="ambient-firefly"
          position={fireflyAt(mover, 0)}
          ref={(node) => {
            fireflies.current[index] = node
          }}
        >
          <Parts parts={FIREFLY_PARTS} />
        </group>
      ))}
      {falling.map((mover, index) => (
        <group
          key={mover.id}
          name="ambient-leaf"
          position={leafAt(mover, 0)}
          ref={(node) => {
            leaves.current[index] = node
          }}
        >
          <Parts parts={LEAF_PARTS} />
        </group>
      ))}
    </group>
  )
}
