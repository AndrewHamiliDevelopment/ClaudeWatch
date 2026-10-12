import type { ReactNode } from 'react'
import { Matte } from '../scene/InstancedParts'
import { Parts, type PartSpec } from './parts'
import type { Vector } from './primitives'
import type { RobotRig } from './types'

type FigureJoint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'

interface JointedFigureProps {
  rig: RobotRig
  joints: Record<FigureJoint, readonly PartSpec[]>
  // Where each rig joint pivots, in the model's own metres; a joint's parts are relative to it.
  pivot: Record<'leftArm' | 'rightArm' | 'head' | 'gear', Vector>
  // Head-local glowing eye band.
  eye: { at: Vector; size: Vector; color: string }
  // Steam and thought dots, riding the body.
  effects: ReactNode
  // Drawn on the floor under the figure; it does not bob with the body.
  ground?: ReactNode
  // Held in the right hand, so it swings with that arm.
  inRightHand?: ReactNode
  sensor?: ReactNode
}

// A character built from unit parts and hung on the shared rig: a theme supplies the parts.
export function JointedFigure({
  rig,
  joints,
  pivot,
  eye,
  effects,
  ground,
  inRightHand,
  sensor
}: JointedFigureProps) {
  return (
    <>
      <group ref={rig.base}>
        <Parts parts={joints.base} />
      </group>
      {ground}
      <group ref={rig.body}>
        <group ref={rig.legs}>
          <Parts parts={joints.legs} />
        </group>
        <Parts parts={joints.body} />
        <group ref={rig.leftArm} position={pivot.leftArm}>
          <Parts parts={joints.leftArm} />
        </group>
        <group ref={rig.rightArm} position={pivot.rightArm}>
          <Parts parts={joints.rightArm} />
          {inRightHand}
        </group>
        <group ref={rig.gear} position={pivot.gear}>
          <Parts parts={joints.gear} />
        </group>
        <group ref={rig.head} position={pivot.head}>
          <Parts parts={joints.head} />
          {sensor}
          {/* Sized geometry, not a unit part: the rig resets this mesh's scale to blink. */}
          <mesh ref={rig.eye} position={eye.at}>
            <boxGeometry args={eye.size} />
            <Matte color={eye.color} glow />
          </mesh>
        </group>
        {effects}
      </group>
    </>
  )
}

// The eye band the Violet Court and Orbital Garrison figures share.
export const VISOR_EYE: { at: Vector; size: Vector } = {
  at: [0, 0.07, 0.145],
  size: [0.2, 0.035, 0.02]
}
