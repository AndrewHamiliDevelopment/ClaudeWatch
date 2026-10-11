import { useMemo } from 'react'
import { Matte } from '../../scene/InstancedParts'
import { RobotEffects } from '../RobotEffects'
import type { RobotModelProps } from '../types'
import { Parts } from '../violet-court/Parts'
import { CREW_PIVOT, crewParts } from './crew-parts'
import { characterFor } from './roster'

// A suited pilot or deck hand at the console; the provider and the office bay decide which one.
export function GarrisonCrew({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const character = characterFor(agent, rosterIndex)
  const joints = useMemo(() => crewParts(character), [character])
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
        <group ref={rig.leftArm} position={CREW_PIVOT.leftArm}>
          <Parts parts={joints.leftArm} />
        </group>
        <group ref={rig.rightArm} position={CREW_PIVOT.rightArm}>
          <Parts parts={joints.rightArm} />
        </group>
        <group ref={rig.gear} position={CREW_PIVOT.gear}>
          <Parts parts={joints.gear} />
        </group>
        <group ref={rig.head} position={CREW_PIVOT.head}>
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
