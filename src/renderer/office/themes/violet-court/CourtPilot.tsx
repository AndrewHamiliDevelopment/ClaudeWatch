import { useMemo } from 'react'
import { JointedFigure, VISOR_EYE } from '../JointedFigure'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { COURT_CAST } from './cast'
import { PILOT_PIVOT, pilotParts } from './pilot-parts'
import { violetCourtRoster } from './roster'

// A uniformed pilot at the desk; which one is decided by the provider and the office bay.
export function CourtPilot({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const castIndex = violetCourtRoster.indexFor(agent, rosterIndex)
  const joints = useMemo(() => pilotParts(COURT_CAST[castIndex]), [castIndex])
  return (
    <JointedFigure
      rig={rig}
      joints={joints}
      pivot={PILOT_PIVOT}
      eye={{ ...VISOR_EYE, color: skin.eye }}
      effects={<RobotEffects rig={rig} />}
    />
  )
}
