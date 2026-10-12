import { JointedFigure } from './JointedFigure'
import { brassParts } from './brass-parts'
import { Parts, box } from './parts'
import { RobotEffects } from './RobotEffects'
import { steamPivot } from './steam-variant'
import type { RobotModelProps } from './types'

export function BrassFrame({ agent, skin, rig }: RobotModelProps) {
  const { variant, joints } = brassParts({ agent, skin })
  return (
    <JointedFigure
      rig={rig}
      joints={joints}
      pivot={steamPivot(variant.build)}
      eye={{ at: [0, 0.01, 0.15], size: [0.2, 0.035, 0.02], color: skin.eye }}
      sensor={
        <group ref={rig.sensor} position={[0, 0.09, 0.1]}>
          <Parts parts={[box([0, 0, 0], [0.08, 0.035, 0.09], skin.trim)]} />
        </group>
      }
      effects={
        <group position={[0, 0.14, 0]}>
          <RobotEffects rig={rig} />
        </group>
      }
    />
  )
}
