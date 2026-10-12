export interface RoutePoint {
  x: number
  z: number
}

interface RouteStop {
  // Metres along the route where the wait happens.
  at: number
  sec: number
  // Gone inside a building for the wait: not drawn, and in nobody's way.
  isIndoors: boolean
}

// Walked from the first point to the last and back again, for ever. A loop ends where it began
// and is walked round and round instead.
export interface CitizenRoute {
  points: RoutePoint[]
  // One way, in metres.
  length: number
  isLoop?: true
  // In the order they are met. Loops only.
  stops?: RouteStop[]
}

export interface CitizenPose extends RoutePoint {
  heading: number
  isIndoors: boolean
}

// A citizen stops this far short of the player rather than walk through it.
export const HOLD_RADIUS_M = 1.1

// Where `metres` along the points is; `isReturning` turns the walker to face the way back.
function poseAlong(route: CitizenRoute, metres: number, isReturning: boolean): CitizenPose {
  let left = metres
  for (let index = 1; index < route.points.length; index++) {
    const from = route.points[index - 1]
    const to = route.points[index]
    const span = Math.hypot(to.x - from.x, to.z - from.z)
    if (span === 0 || (left > span && index < route.points.length - 1)) {
      left -= span
      continue
    }
    const along = { x: (to.x - from.x) / span, z: (to.z - from.z) / span }
    return {
      x: from.x + along.x * left,
      z: from.z + along.z * left,
      heading: isReturning ? Math.atan2(-along.x, -along.z) : Math.atan2(along.x, along.z),
      isIndoors: false
    }
  }
  return { ...route.points[0], heading: 0, isIndoors: false }
}

// Where a walker is after `travelled` metres' worth of walking time. A wait at a stop uses up
// the metres it would have walked at `speed`, so one number says where it is and whether it waits.
export function routePose(route: CitizenRoute, travelled: number, speed = 1): CitizenPose {
  if (route.length <= 0) return { ...route.points[0], heading: 0, isIndoors: false }
  if (!route.isLoop) {
    const lap = travelled % (route.length * 2)
    const isReturning = lap > route.length
    return poseAlong(route, isReturning ? route.length * 2 - lap : lap, isReturning)
  }
  const stops = route.stops ?? []
  const waited = stops.reduce((sum, stop) => sum + stop.sec * speed, 0)
  let metres = travelled % (route.length + waited)
  for (const stop of stops) {
    if (metres < stop.at) break
    const wait = stop.sec * speed
    if (metres < stop.at + wait) return { ...poseAlong(route, stop.at, false), ...stop }
    metres -= wait
  }
  return poseAlong(route, metres, false)
}

interface Step {
  route: CitizenRoute
  speed: number
  // Seconds this mover has spent on its route so far.
  walked: number
  deltaSec: number
  player: RoutePoint | null
  // Whoever else it must not run into: for a vehicle, the citizens out of doors.
  others?: readonly RoutePoint[]
  // How far ahead of its middle its front is, and how near that may come to anyone.
  reach?: number
  radius?: number
}

// A frame's moving added on, unless the step would bring it up against the player or another.
export function walkedSec(step: Step): number {
  const { route, speed, walked, deltaSec, player, others = [], reach = 0 } = step
  const radius = step.radius ?? HOLD_RADIUS_M
  const next = walked + deltaSec
  if (!player && others.length === 0) return next
  const front = routePose(route, next * speed + reach, speed)
  const isNear = (point: RoutePoint): boolean =>
    Math.hypot(front.x - point.x, front.z - point.z) < radius
  return (player && isNear(player)) || others.some(isNear) ? walked : next
}
