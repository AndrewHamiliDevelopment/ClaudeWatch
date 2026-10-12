import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Object3D } from 'three'
import type { FloorGeometry } from '../scene-model'
import { designFor, lotBase, plotOf, seeded, type LotDesign, type Plot } from './lot-parts'
import type { Lot } from './surroundings'
import { UnitPart } from './unit-parts'

// Where steam leaves a stack, and how far it may rise before the lot's height limit.
export interface SteamStack {
  x: number
  y: number
  z: number
  rise: number
}

const PUFFS_PER_STACK = 3
const PUFF_PERIOD_SEC = 4
const PUFF_SIZE = { start: 0.3, growth: 0.8 }
const MAX_PUFF_M = PUFF_SIZE.start + PUFF_SIZE.growth
const MAX_STACK_LOTS = 4
// What a still frame shows: three puffs caught mid-rise.
const HELD_TIME_SEC = 1.7

// A puff's place in its climb (0 at the stack, 1 at the top) and its size; it shrinks away at the top.
export function steamPuffAt(timeSec: number, nth: number): { lift: number; size: number } {
  const lift = (((timeSec / PUFF_PERIOD_SEC + nth / PUFFS_PER_STACK) % 1) + 1) % 1
  const fade = Math.min(1, (1 - lift) * 4)
  return { lift, size: (PUFF_SIZE.start + PUFF_SIZE.growth * lift) * fade }
}

function placePuff(puff: Object3D, stack: SteamStack, timeSec: number, index: number): void {
  const { lift, size } = steamPuffAt(timeSec + stack.x * 0.37, index % PUFFS_PER_STACK)
  puff.position.set(stack.x, stack.y + lift * (stack.rise - MAX_PUFF_M / 2), stack.z)
  puff.scale.setScalar(size)
}

export function moveSteam(root: Object3D, stacks: readonly SteamStack[], timeSec: number): void {
  root.children.forEach((puff, index) => {
    const stack = stacks[Math.floor(index / PUFFS_PER_STACK)]
    if (stack) placePuff(puff, stack, timeSec, index)
  })
}

// The stacks on the few lots that drew `design`, picked by seed so they are the same every start.
export function steamStacksOn(
  lots: readonly Lot[],
  floor: Pick<FloorGeometry, 'width' | 'depth'>,
  buildings: readonly LotDesign[],
  design: string,
  stacksOf: (plot: Plot) => { x: number; z: number; top: number }[],
  rise: number
): SteamStack[] {
  return lots
    .filter((lot) => lot.kind === 'building')
    .map((lot) => ({ lot, plot: plotOf(lot, lotBase(lot, floor)) }))
    .filter(({ plot }) => designFor(buildings, plot).name === design)
    .sort((a, b) => seeded(a.lot.seed, 70) - seeded(b.lot.seed, 70))
    .slice(0, MAX_STACK_LOTS)
    .flatMap(({ lot, plot }) =>
      stacksOf(plot).map((stack) => ({
        x: lot.x + stack.x,
        y: lot.maxHeight - plot.height + stack.top,
        z: lot.z + stack.z,
        rise
      }))
    )
}

// Opaque puffs that shrink away instead of fading: they merge into one draw with no sorting.
export function RisingSteam({
  stacks,
  color,
  isReducedMotion
}: {
  stacks: readonly SteamStack[]
  color: string
  isReducedMotion: boolean
}) {
  const root = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!isReducedMotion && root.current) moveSteam(root.current, stacks, clock.elapsedTime)
  })
  return (
    <group ref={root}>
      {stacks.flatMap((stack, stackIndex) =>
        Array.from({ length: PUFFS_PER_STACK }, (_, nth) => {
          const { lift, size } = steamPuffAt(HELD_TIME_SEC + stack.x * 0.37, nth)
          return (
            <UnitPart
              key={`${stackIndex}:${nth}`}
              shape="sphere"
              at={[stack.x, stack.y + lift * (stack.rise - MAX_PUFF_M / 2), stack.z]}
              size={[size, size, size]}
              color={color}
            />
          )
        })
      )}
    </group>
  )
}
