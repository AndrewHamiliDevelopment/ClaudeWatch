import { useLayoutEffect } from 'react'
import { JointedFigure } from './JointedFigure'
import { sensorOpening } from './layout'
import { Parts, box } from './parts'
import { RobotEffects } from './RobotEffects'
import { samuraiParts } from './samurai-parts'
import { steamPivot } from './steam-variant'
import type { RobotModelProps } from './types'

export function SamuraiFrame({ agent, skin, rig }: RobotModelProps) {
  const { variant, joints } = samuraiParts({ agent, skin })
  useLayoutEffect(() => {
    // Held articulation also works when the renderer disables its animation loop.
    if (rig.sensor.current) rig.sensor.current.rotation.x = sensorOpening(agent.activity)
  }, [agent.activity, rig.sensor])
  return (
    <JointedFigure
      rig={rig}
      joints={joints}
      pivot={steamPivot(variant.build)}
      eye={{ at: [0, -0.015, 0.155], size: [0.19, 0.025, 0.015], color: skin.eye }}
      sensor={
        <group ref={rig.sensor} position={[0, 0.03, 0.14]}>
          <Parts parts={[box([0, 0.025, 0], [0.22, 0.045, 0.025], skin.body)]} />
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
