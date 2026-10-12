import { makeSession } from '../../__tests__/fixtures'
import { layoutFloor } from '../../fixture/fixture-layout'
import type { FloorGeometry } from '../../scene-model'
import type { Rect } from '../lot-math'
import { gapBetween, officesOf } from '../surroundings'
import type { PlacedPart } from './placed'

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

// The surroundings engine's own rule: how far a thing is from the nearest office.
export function officeGap(floor: FloorGeometry, rect: Rect): number {
  return Math.min(...officesOf(floor).map((office) => gapBetween(rect, office)))
}
