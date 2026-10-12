import { buildLayout } from '../../../office/sim/layout'
import { toFloorGeometry } from '../../office-live/layout-geometry'
import { makeSession } from '../__tests__/fixtures'
import { plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'

// A floor as the running app lays it out: the gate at the origin, the plate off to one side.
function liveFloor(companies: number, projects: number, sessions: number): FloorGeometry {
  const refs = Array.from({ length: sessions }, (_, index) =>
    makeSession({
      key: `claude:${index}`,
      provider: index % 2 ? 'codex' : 'claude',
      companyKey: `c_${index % companies}`,
      companyLabel: `Company ${index % companies}`,
      projectKey: `p_${index % projects}`,
      projectLabel: `Project ${index % projects}`
    })
  )
  return toFloorGeometry(buildLayout(refs, undefined, 0), refs)[0]
}

export const LIVE_FLOORS: readonly (readonly [string, FloorGeometry])[] = [
  ['a lone company', liveFloor(1, 1, 1)],
  ['two companies', liveFloor(2, 2, 4)],
  ['three companies, six projects and ten sessions', liveFloor(3, 6, 10)]
]

// The same floor with its plate centre somewhere else, everything on it moved along.
function recentred(floor: FloorGeometry, centre: { x: number; z: number }): FloorGeometry {
  const local = plateLocalFloor(floor)
  // plateLocalFloor moves a floor by minus the centre it carries: a negated one moves it out.
  return { ...plateLocalFloor({ ...local, x: -centre.x, z: -centre.z }), ...centre }
}

export const OFF_CENTRE_FLOOR = recentred(liveFloor(2, 2, 4), { x: 20, z: -12 })
