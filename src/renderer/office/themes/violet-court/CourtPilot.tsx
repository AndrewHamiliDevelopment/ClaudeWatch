import { useMemo } from 'react'
import { JointedFigure, VISOR_EYE } from '../JointedFigure'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { PILOT_PIVOT, pilotParts } from './pilot-parts'
import { courtLook } from './roster'

// A uniformed pilot at the desk: the agent's own key picks the character, its build and its trim.
export function CourtPilot({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const { who, build } = courtLook(agent, rosterIndex)
  const joints = useMemo(() => pilotParts(who), [who])
  return (
    <group scale={[build.girth, build.height, build.girth]}>
      <JointedFigure
        rig={rig}
        joints={joints}
        pivot={PILOT_PIVOT}
        eye={{ ...VISOR_EYE, color: skin.eye }}
        effects={<RobotEffects rig={rig} />}
      />
    </group>
  )
}
