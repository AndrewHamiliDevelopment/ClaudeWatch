import type { Point } from '../../../office/sim/path'
import type { WalkGround } from './walk-ground'

export const WALK_SPEED_M_PER_SEC = 4
// An agent this close can be spoken to.
const REACH_M = 2
// A slow machine keeps the pace up to this long a frame; a stall longer than it is not walked.
export const MAX_FRAME_SEC = 0.25
// Shorter than a cell of the walk ground, so no step can jump a wall.
const STEP_M = 0.1
const ARRIVED_M = 1e-6

// Screen directions: x to the right, y up the screen.
const KEY_DIRECTION: Record<string, readonly [number, number] | undefined> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, 1],
  s: [0, -1],
  a: [-1, 0],
  d: [1, 0]
}

// The name a walking key is held under, or null for any other key.
export function walkKey(key: string): string | null {
  const name = key.length === 1 ? key.toLowerCase() : key
  return KEY_DIRECTION[name] ? name : null
}

// The owner's character. Local to the page: nothing here is sent anywhere.
export interface Player {
  position: Point
  // Yaw in radians, like an agent's: it faces (sin heading, cos heading).
  heading: number
  // Waypoints still to walk, nearest first.
  path: Point[]
  held: Set<string>
  // Where it was last sent; the scene turns this into a path on its next frame.
  goal: Point | null
  // Set by the scene while it is mounted, so a new goal draws a frame.
  onGoal: (() => void) | null
}

export function createPlayer(position: Point): Player {
  return {
    position: { ...position },
    heading: 0,
    path: [],
    held: new Set(),
    goal: null,
    onGoal: null
  }
}

export function sendPlayer(player: Player, to: Point): void {
  player.goal = { x: to.x, z: to.z }
  player.onGoal?.()
}

export function heldDirection(held: ReadonlySet<string>): { x: number; y: number } | null {
  let x = 0
  let y = 0
  for (const key of held) {
    const direction = KEY_DIRECTION[key]
    if (!direction) continue
    x += direction[0]
    y += direction[1]
  }
  x = Math.sign(x)
  y = Math.sign(y)
  return x === 0 && y === 0 ? null : { x, y }
}

// A unit step on the ground for a screen direction: "up" is away from the viewer at any rotation.
export function screenMove(direction: { x: number; y: number }, azimuth: number): Point {
  const sin = Math.sin(azimuth)
  const cos = Math.cos(azimuth)
  const length = Math.hypot(direction.x, direction.y) || 1
  return {
    x: (direction.x * cos - direction.y * sin) / length,
    z: (-direction.x * sin - direction.y * cos) / length
  }
}

// Walks `metres` along `direction`, an axis at a time: a wall stops the axis that meets it and
// leaves the other, so the player slides along it and never passes through.
export function stepWalk(
  from: Point,
  direction: Point,
  metres: number,
  isOpen: (point: Point) => boolean
): Point {
  const position = { ...from }
  for (let left = metres; left > ARRIVED_M; left -= STEP_M) {
    const step = Math.min(STEP_M, left)
    const alongX = { x: position.x + direction.x * step, z: position.z }
    if (direction.x !== 0 && isOpen(alongX)) position.x = alongX.x
    const alongZ = { x: position.x, z: position.z + direction.z * step }
    if (direction.z !== 0 && isOpen(alongZ)) position.z = alongZ.z
  }
  return position
}

function walkPathBy(player: Player, metres: number): void {
  let left = metres
  while (left > ARRIVED_M && player.path.length > 0) {
    const [next] = player.path
    const dx = next.x - player.position.x
    const dz = next.z - player.position.z
    const distance = Math.hypot(dx, dz)
    if (distance > ARRIVED_M) player.heading = Math.atan2(dx, dz)
    if (distance <= left) {
      player.position = { ...next }
      player.path.shift()
      left -= distance
    } else {
      player.position = {
        x: player.position.x + (dx / distance) * left,
        z: player.position.z + (dz / distance) * left
      }
      left = 0
    }
  }
}

// One frame of walking. True when the player moved or turned, which is the only time the scene
// needs another frame: held against a wall, or standing, it asks for none.
export function tickPlayer(
  player: Player,
  ground: Pick<WalkGround, 'isOpen'>,
  deltaSec: number,
  azimuth: number
): boolean {
  const metres = WALK_SPEED_M_PER_SEC * Math.min(deltaSec, MAX_FRAME_SEC)
  const direction = heldDirection(player.held)
  if (!direction) {
    if (player.path.length === 0) return false
    walkPathBy(player, metres)
    return true
  }
  // The keys are the owner's hand on the player: they end a walk it was sent on.
  player.path = []
  const move = screenMove(direction, azimuth)
  const next = stepWalk(player.position, move, metres, ground.isOpen)
  const heading = Math.atan2(move.x, move.z)
  const hasChanged =
    next.x !== player.position.x || next.z !== player.position.z || heading !== player.heading
  player.position = next
  player.heading = heading
  return hasChanged
}

// The nearest agent close enough to speak to, if any.
export function agentInReach<Agent extends Point>(
  position: Point,
  agents: readonly Agent[]
): Agent | null {
  let nearest: Agent | null = null
  let nearestDistance = REACH_M
  for (const agent of agents) {
    const distance = Math.hypot(agent.x - position.x, agent.z - position.z)
    if (distance <= nearestDistance) {
      nearest = agent
      nearestDistance = distance
    }
  }
  return nearest
}
