import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Object3D } from 'three'
import type { Vector } from './primitives'
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
// What a still frame shows: three puffs caught mid-rise.
const HELD_TIME_SEC = 1.7

// A puff's place in its climb (0 at the stack, 1 at the top) and its size; it shrinks away at the top.
export function steamPuffAt(timeSec: number, nth: number): { lift: number; size: number } {
  const lift = (((timeSec / PUFF_PERIOD_SEC + nth / PUFFS_PER_STACK) % 1) + 1) % 1
  const fade = Math.min(1, (1 - lift) * 4)
  return { lift, size: (PUFF_SIZE.start + PUFF_SIZE.growth * lift) * fade }
}

// Stacks are out of step with each other, so a street of chimneys does not puff in unison.
function puffOf(stack: SteamStack, timeSec: number, index: number): { at: Vector; size: number } {
  const { lift, size } = steamPuffAt(timeSec + stack.x * 0.37, index % PUFFS_PER_STACK)
  return { at: [stack.x, stack.y + lift * (stack.rise - MAX_PUFF_M / 2), stack.z], size }
}

export function moveSteam(root: Object3D, stacks: readonly SteamStack[], timeSec: number): void {
  root.children.forEach((puff, index) => {
    const stack = stacks[Math.floor(index / PUFFS_PER_STACK)]
    if (!stack) return
    const { at, size } = puffOf(stack, timeSec, index)
    puff.position.set(...at)
    puff.scale.setScalar(size)
  })
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
          const { at, size } = puffOf(stack, HELD_TIME_SEC, nth)
          return (
            <UnitPart
              key={`${stackIndex}:${nth}`}
              shape="sphere"
              at={at}
              size={[size, size, size]}
              color={color}
            />
          )
        })
      )}
    </group>
  )
}
