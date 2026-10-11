export type ZoomBand = 'desk' | 'floor' | 'building'
export type ZoomDirection = 'in' | 'out'

// Orthographic zoom in screen pixels per metre: the desk fly-to, the scene's first frame and the
// cap on the building overview.
export const BAND_ZOOM: Record<ZoomBand, number> = { desk: 90, floor: 34, building: 8 }

const DEG_TO_RAD = Math.PI / 180
const ISO_ELEVATION_DEG = 35
// camera-controls measures polar angle from straight up.
export const ISO_POLAR = (90 - ISO_ELEVATION_DEG) * DEG_TO_RAD
export const ISO_START_AZIMUTH = 45 * DEG_TO_RAD
const SNAP_STEP = 90 * DEG_TO_RAD
const SNAP_EPSILON = 1e-6

const DESK_ENTER_ZOOM = 55
const DESK_LEAVE_ZOOM = 48
// Fractions of the zoom that fits this floor, which runs from 8 px/m (a full plate) to 60 (one office).
const BUILDING_ENTER_FIT = 0.8
const BUILDING_LEAVE_FIT = 0.9

// The band is a level of detail read off the zoom, never a zoom to snap to. Each threshold has
// a gap between entering and leaving, so hovering on one does not flicker the cards.
export function bandForZoom(zoom: number, previous: ZoomBand, floorFitZoom: number): ZoomBand {
  if (zoom >= (previous === 'desk' ? DESK_LEAVE_ZOOM : DESK_ENTER_ZOOM)) return 'desk'
  // A lone office fits above the desk threshold; measured from there it would have no floor level.
  const fitZoom = Math.min(floorFitZoom, DESK_LEAVE_ZOOM)
  const buildingBelow =
    fitZoom * (previous === 'building' ? BUILDING_LEAVE_FIT : BUILDING_ENTER_FIT)
  return zoom < buildingBelow ? 'building' : 'floor'
}

// The four isometric corners sit at 45° + k·90°.
export function snapAzimuth(azimuth: number, direction: -1 | 1): number {
  const steps = (azimuth - ISO_START_AZIMUTH) / SNAP_STEP
  const target =
    direction > 0 ? Math.floor(steps + SNAP_EPSILON) + 1 : Math.ceil(steps - SNAP_EPSILON) - 1
  return ISO_START_AZIMUTH + target * SNAP_STEP
}

export function buildingFraming(
  floor: { width: number; depth: number },
  floorCount: number,
  viewport: { width: number; height: number }
) {
  // World props reach 12 m beyond either side, 19 m north and 7 m south of the plate.
  const width = floor.width + 24
  const depth = floor.depth + 26
  const height = Math.max(8, floorCount * 2.2 + 1)
  const projectedWidth = (width + depth) / Math.SQRT2
  const projectedHeight = projectedWidth * Math.cos(ISO_POLAR) + height * Math.sin(ISO_POLAR)
  return {
    target: [0, height / 2, -6] as [number, number, number],
    projectedWidth,
    projectedHeight,
    zoom: Math.max(
      0.1,
      Math.min(
        BAND_ZOOM.building,
        viewport.width / (projectedWidth * 1.2),
        viewport.height / (projectedHeight * 1.2)
      )
    )
  }
}

// Desk zoom follows the room an agent sits in, not the agent itself (it moves while walking).
export interface FollowAnchor {
  agentKey: string
  roomX: number
  roomZ: number
}

export type FollowStep =
  | { kind: 'stay' }
  | { kind: 'shift'; dx: number; dz: number; anchor: FollowAnchor }
  | { kind: 'lost' }

interface FollowedAgent {
  agentKey: string
  roomId: string
}

interface RoomCentre {
  id: string
  x: number
  z: number
}

const ROOM_MOVED_EPSILON_M = 0.01

export function followAnchor(
  agent: FollowedAgent,
  rooms: readonly RoomCentre[]
): FollowAnchor | null {
  const room = rooms.find((candidate) => candidate.id === agent.roomId)
  return room ? { agentKey: agent.agentKey, roomX: room.x, roomZ: room.z } : null
}

// 'shift' carries a delta, so a pan the owner made inside the office is kept, only moved along.
export function followStep(
  anchor: FollowAnchor,
  agents: readonly FollowedAgent[],
  rooms: readonly RoomCentre[]
): FollowStep {
  const agent = agents.find((candidate) => candidate.agentKey === anchor.agentKey)
  if (!agent) return { kind: 'lost' }
  const next = followAnchor(agent, rooms)
  if (!next) return { kind: 'stay' }
  const dx = next.roomX - anchor.roomX
  const dz = next.roomZ - anchor.roomZ
  if (Math.hypot(dx, dz) < ROOM_MOVED_EPSILON_M) return { kind: 'stay' }
  return { kind: 'shift', dx, dz, anchor: next }
}
