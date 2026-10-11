import type { FloorGeometry, ZoneGeometry } from '../scene-model'
import { BAND_ZOOM, ISO_POLAR } from './camera-bands'

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ScreenView {
  target: [number, number, number]
  zoom: number
  azimuth: number
}

interface Viewport {
  width: number
  height: number
}

interface Insets {
  left: number
  right: number
  top: number
  bottom: number
}

// Screen area the HUD covers: left rail 16rem and right panel 17rem plus the 12 px grid padding
// and gap, the bottom bar, and headroom above for name cards (QA: a lone office sat under "Needs you").
export const HUD_SAFE_INSETS: Insets = { left: 280, right: 296, top: 72, bottom: 96 }
// Below this safe width the rails stack (md breakpoint), so framing uses the whole viewport.
const MIN_SAFE_WIDTH = 240
const OCCUPIED_PADDING_M = 1.5
// Name cards float about 2 m up; framing includes that height so cards are not cut off.
const FRAMED_HEIGHT_M = 2.6
const MIN_FRAME_ZOOM = 4

const COS_POLAR = Math.cos(ISO_POLAR)
const SIN_POLAR = Math.sin(ISO_POLAR)

export function boundsOfZone(zone: Pick<ZoneGeometry, 'x' | 'z' | 'width' | 'depth'>): Bounds {
  return {
    minX: zone.x - zone.width / 2,
    maxX: zone.x + zone.width / 2,
    minZ: zone.z - zone.depth / 2,
    maxZ: zone.z + zone.depth / 2
  }
}

function union(all: readonly Bounds[]): Bounds {
  return {
    minX: Math.min(...all.map((bounds) => bounds.minX)),
    maxX: Math.max(...all.map((bounds) => bounds.maxX)),
    minZ: Math.min(...all.map((bounds) => bounds.minZ)),
    maxZ: Math.max(...all.map((bounds) => bounds.maxZ))
  }
}

function pad(bounds: Bounds, metres: number): Bounds {
  return {
    minX: bounds.minX - metres,
    maxX: bounds.maxX + metres,
    minZ: bounds.minZ - metres,
    maxZ: bounds.maxZ + metres
  }
}

function hasLiveSession(zone: ZoneGeometry, live: ReadonlySet<string>): boolean {
  if (zone.sessionKey && live.has(zone.sessionKey)) return true
  return zone.children.some((child) => hasLiveSession(child, live))
}

function occupiedProjects(
  zones: readonly ZoneGeometry[],
  live: ReadonlySet<string>
): ZoneGeometry[] {
  return zones.flatMap((zone) => {
    if (!hasLiveSession(zone, live)) return []
    return zone.kind === 'project' ? [zone] : occupiedProjects(zone.children, live)
  })
}

// The part of the floor worth looking at: project offices with live sessions, else the leaf
// rooms with sessions, else the whole plate.
export function occupiedBounds(floor: FloorGeometry, liveSessionKeys: ReadonlySet<string>): Bounds {
  const projects = occupiedProjects(floor.zones, liveSessionKeys)
  if (projects.length > 0) return pad(union(projects.map(boundsOfZone)), OCCUPIED_PADDING_M)
  const rooms = floor.rooms.filter(
    (room) => room.sessionKey && liveSessionKeys.has(room.sessionKey)
  )
  if (rooms.length > 0) return pad(union(rooms.map(boundsOfZone)), OCCUPIED_PADDING_M)
  return boundsOfZone({ x: 0, z: 0, width: floor.width, depth: floor.depth })
}

// Orthographic isometric projection into "screen metres": x to the right, y up the screen.
function toScreenMetres(point: { x: number; y: number; z: number }, azimuth: number) {
  const sin = Math.sin(azimuth)
  const cos = Math.cos(azimuth)
  return {
    x: point.x * cos - point.z * sin,
    y: point.y * SIN_POLAR - (point.x * sin + point.z * cos) * COS_POLAR
  }
}

export function projectToScreen(
  point: { x: number; y: number; z: number },
  view: ScreenView,
  viewport: Viewport
): { x: number; y: number } {
  const [tx, ty, tz] = view.target
  const relative = toScreenMetres(
    { x: point.x - tx, y: point.y - ty, z: point.z - tz },
    view.azimuth
  )
  return {
    x: viewport.width / 2 + relative.x * view.zoom,
    y: viewport.height / 2 - relative.y * view.zoom
  }
}

// Fit the bounds (and the name cards above them) into the area the HUD leaves free, then place
// the camera target on the ground so the bounds' centre lands at that area's centre.
export function frameBounds(
  bounds: Bounds,
  viewport: Viewport,
  options: { azimuth: number; maxZoom?: number; insets?: Insets }
): { target: [number, number, number]; zoom: number } {
  const requested = options.insets ?? HUD_SAFE_INSETS
  const hasRoomForRails = viewport.width - requested.left - requested.right >= MIN_SAFE_WIDTH
  const insets = hasRoomForRails ? requested : { ...requested, left: 0, right: 0 }
  const safeWidth = viewport.width - insets.left - insets.right
  const safeHeight = Math.max(1, viewport.height - insets.top - insets.bottom)

  const projected = [bounds.minX, bounds.maxX].flatMap((x) =>
    [bounds.minZ, bounds.maxZ].flatMap((z) =>
      [0, FRAMED_HEIGHT_M].map((y) => toScreenMetres({ x, y, z }, options.azimuth))
    )
  )
  const minX = Math.min(...projected.map((point) => point.x))
  const maxX = Math.max(...projected.map((point) => point.x))
  const minY = Math.min(...projected.map((point) => point.y))
  const maxY = Math.max(...projected.map((point) => point.y))
  const fit = Math.min(
    safeWidth / Math.max(maxX - minX, 0.01),
    safeHeight / Math.max(maxY - minY, 0.01)
  )
  const zoom = Math.max(MIN_FRAME_ZOOM, Math.min(options.maxZoom ?? BAND_ZOOM.desk, fit))

  // Screen-metre position the target must have so the bounds' centre sits mid safe-area.
  const targetX = (minX + maxX) / 2 - (insets.left + safeWidth / 2 - viewport.width / 2) / zoom
  const targetY = (minY + maxY) / 2 + (insets.top + safeHeight / 2 - viewport.height / 2) / zoom
  const depth = -targetY / COS_POLAR
  const sin = Math.sin(options.azimuth)
  const cos = Math.cos(options.azimuth)
  return { target: [targetX * cos + depth * sin, 0, -targetX * sin + depth * cos], zoom }
}
