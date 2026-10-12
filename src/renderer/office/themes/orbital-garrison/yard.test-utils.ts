import { makeSession } from '../../__tests__/fixtures'
import { layoutFloor } from '../../fixture/fixture-layout'
import type { FloorGeometry, ZoneGeometry } from '../../scene-model'
import type { PlacedPart } from './placed'

interface Rect {
  x: number
  z: number
  width: number
  depth: number
}

function floorWith(agentCount: number, companyCount: number): FloorGeometry {
  const sessions = Array.from({ length: agentCount }, (_, index) =>
    makeSession({
      key: `claude:${index}`,
      provider: index % 2 ? 'codex' : 'claude',
      companyKey: `c_${index % companyCount}`,
      companyLabel: `Company ${index % companyCount}`,
      projectKey: `p_${index % companyCount}`,
      projectLabel: `Project ${index % companyCount}`
    })
  )
  return layoutFloor({ floorId: 'garrison', label: 'Garrison', plate: 1, sessions })
}

// One company, four companies and a wide ten-company floor.
export const FLOORS: readonly FloorGeometry[] = [
  floorWith(2, 1),
  floorWith(20, 4),
  floorWith(60, 10)
]

// A placed part's footprint and height; quarter turns only, so the sides swap and nothing else.
export function boundsOf(part: PlacedPart) {
  const quarterTurns = part.rotationY / (Math.PI / 2)
  const isSideways = Math.abs(Math.round(quarterTurns)) % 2 === 1
  return {
    x: part.x,
    z: part.z,
    width: isSideways ? part.scaleZ : part.scaleX,
    depth: isSideways ? part.scaleX : part.scaleZ,
    top: part.y + part.scaleY / 2,
    bottom: part.y - part.scaleY / 2,
    isQuarterTurned: Math.abs(quarterTurns - Math.round(quarterTurns)) < 1e-9
  }
}

export function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

function projects(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [
    ...(zone.kind === 'project' ? [zone] : []),
    ...projects(zone.children)
  ])
}

// The surroundings engine's own rule: how far a thing is from the nearest office.
export function officeGap(floor: FloorGeometry, rect: Rect): number {
  return Math.min(...projects(floor.zones).map((office) => gapBetween(rect, office)))
}
