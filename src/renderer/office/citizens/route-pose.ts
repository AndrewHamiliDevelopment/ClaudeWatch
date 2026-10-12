export interface RoutePoint {
  x: number
  z: number
}

// Walked from the first point to the last and back again, for ever.
export interface CitizenRoute {
  points: RoutePoint[]
  // One way, in metres.
  length: number
}

export interface CitizenPose extends RoutePoint {
  heading: number
}

// A citizen stops this far short of the player rather than walk through it.
export const HOLD_RADIUS_M = 1.1

// Where a citizen is after walking `travelled` metres, out and back as often as it takes.
export function routePose(route: CitizenRoute, travelled: number): CitizenPose {
  const [first] = route.points
  if (route.length <= 0) return { ...first, heading: 0 }
  const lap = travelled % (route.length * 2)
  const isReturning = lap > route.length
  let left = isReturning ? route.length * 2 - lap : lap
  for (let index = 1; index < route.points.length; index++) {
    const from = route.points[index - 1]
    const to = route.points[index]
    const span = Math.hypot(to.x - from.x, to.z - from.z)
    if (left > span && index < route.points.length - 1) {
      left -= span
      continue
    }
    const along = { x: (to.x - from.x) / span, z: (to.z - from.z) / span }
    return {
      x: from.x + along.x * left,
      z: from.z + along.z * left,
      heading: isReturning ? Math.atan2(-along.x, -along.z) : Math.atan2(along.x, along.z)
    }
  }
  return { ...first, heading: 0 }
}

interface Step {
  route: CitizenRoute
  speed: number
  // Seconds this citizen has spent walking so far.
  walked: number
  deltaSec: number
  player: RoutePoint | null
}

// A frame's walking added on, unless the step would bring it up against the player.
export function walkedSec({ route, speed, walked, deltaSec, player }: Step): number {
  const next = walked + deltaSec
  if (!player) return next
  const ahead = routePose(route, next * speed)
  const isHeld = Math.hypot(ahead.x - player.x, ahead.z - player.z) < HOLD_RADIUS_M
  return isHeld ? walked : next
}
