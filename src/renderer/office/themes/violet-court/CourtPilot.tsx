import { useMemo } from 'react'
import { Matte } from '../../scene/InstancedParts'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { COURT_CAST } from './cast'
import { Parts } from './Parts'
import { PILOT_PIVOT, pilotParts } from './pilot-parts'
import { castIndexFor } from './roster'

// A uniformed pilot at the desk; which one is decided by the provider and the office bay.
export function CourtPilot({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const castIndex = castIndexFor(agent, rosterIndex)
  const joints = useMemo(() => pilotParts(COURT_CAST[castIndex]), [castIndex])
  return (
    <>
      <group ref={rig.base}>
        <Parts parts={joints.base} />
      </group>
      <group ref={rig.body}>
        <group ref={rig.legs}>
          <Parts parts={joints.legs} />
        </group>
        <Parts parts={joints.body} />
        <group ref={rig.leftArm} position={PILOT_PIVOT.leftArm}>
          <Parts parts={joints.leftArm} />
        </group>
        <group ref={rig.rightArm} position={PILOT_PIVOT.rightArm}>
          <Parts parts={joints.rightArm} />
        </group>
        <group ref={rig.gear} position={PILOT_PIVOT.gear}>
          <Parts parts={joints.gear} />
        </group>
        <group ref={rig.head} position={PILOT_PIVOT.head}>
          <Parts parts={joints.head} />
          {/* Sized geometry, not a unit part: the rig resets this mesh's scale to blink. */}
          <mesh ref={rig.eye} position={[0, 0.07, 0.145]}>
            <boxGeometry args={[0.2, 0.035, 0.02]} />
            <Matte color={skin.eye} glow />
          </mesh>
        </group>
        <RobotEffects rig={rig} />
      </group>
    </>
  )
}
