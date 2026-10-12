import { useMemo } from 'react'
import { JointedFigure, VISOR_EYE } from '../JointedFigure'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { CREW_PIVOT, crewParts } from './crew-parts'
import { garrisonLook } from './roster'

// A suited member of the garrison at the console: the agent's own key picks the character,
// its build and its trim.
export function GarrisonCrew({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const { who, build } = garrisonLook(agent, rosterIndex)
  const joints = useMemo(() => crewParts(who), [who])
  return (
    <group scale={[build.girth, build.height, build.girth]}>
      <JointedFigure
        rig={rig}
        joints={joints}
        pivot={CREW_PIVOT}
        eye={{ ...VISOR_EYE, color: skin.eye }}
        effects={<RobotEffects rig={rig} />}
      />
    </group>
  )
}
