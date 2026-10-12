import { makeSession } from '../../__tests__/fixtures'
import { layoutFloor } from '../../fixture/fixture-layout'
import type { FloorGeometry } from '../../scene-model'
import type { Rect } from '../lot-math'
import { gapBetween, officesOf } from '../surroundings'

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
  return layoutFloor({ sessions })
}

// One company, four companies and a wide ten-company floor.
export const FLOORS: readonly FloorGeometry[] = [
  floorWith(2, 1),
  floorWith(20, 4),
  floorWith(60, 10)
]

// How far a thing is from the nearest office: what every height limit is measured from.
export function officeGap(floor: FloorGeometry, rect: Rect): number {
  return Math.min(...officesOf(floor).map((office) => gapBetween(rect, office)))
}
