import { useMemo } from 'react'
import { JointedFigure, VISOR_EYE } from '../JointedFigure'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { CREW_PIVOT, crewParts } from './crew-parts'
import { characterFor } from './roster'

// A suited pilot or deck hand at the console; the provider and the office bay decide which one.
export function GarrisonCrew({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const character = characterFor(agent, rosterIndex)
  const joints = useMemo(() => crewParts(character), [character])
  return (
    <JointedFigure
      rig={rig}
      joints={joints}
      pivot={CREW_PIVOT}
      eye={{ ...VISOR_EYE, color: skin.eye }}
      effects={<RobotEffects rig={rig} />}
    />
  )
}
