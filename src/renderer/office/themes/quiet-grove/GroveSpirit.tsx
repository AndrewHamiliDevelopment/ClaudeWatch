import { useMemo } from 'react'
import { moodFor } from '../../logic/character-pose'
import { Matte } from '../../scene/InstancedParts'
import type { RobotModelProps } from '../types'
import { UNIT_SHAPES, UnitPart } from '../unit-parts'
import { Parts } from '../violet-court/Parts'
import { GROVE_CAST } from './cast'
import { GROVE } from './palette'
import { castIndexFor } from './roster'
import { spiritBuild } from './spirit-parts'

// Where each firefly rises (x, z); the rig sets its height and size while the agent works,
// and keeps all three hidden under reduced motion.
const FIREFLY_STARTS = [
  [-0.14, 0.06],
  [0.05, -0.08],
  [0.17, 0.1]
] as const
const THOUGHT_DOTS = [-0.1, 0, 0.1]
// Above the decking, and narrower than the selection ring so the ring still shows around it.
const HALO = { y: 0.03, width: 0.82 }

// dry-new: RobotEffects draws three see-through puffs per agent, and see-through parts never
// merge. These are opaque unit spheres in one glow colour, so a whole floor shares one draw.
function GroveEffects({ rig, crown }: Pick<RobotModelProps, 'rig'> & { crown: number }) {
  return (
    <>
      {rig.puffs.map((ref, index) => (
        <mesh
          key={index}
          ref={ref}
          position={[FIREFLY_STARTS[index][0], 0, FIREFLY_STARTS[index][1]]}
          visible={false}
        >
          {UNIT_SHAPES.sphere}
          <Matte color={GROVE.lumen} glow />
        </mesh>
      ))}
      <group ref={rig.thought} position={[0, crown, 0]} visible={false}>
        {THOUGHT_DOTS.map((x) => (
          <UnitPart
            key={x}
            shape="sphere"
            at={[x, 0, 0]}
            size={[0.06, 0.06, 0.06]}
            color={GROVE.lumen}
            glow
          />
        ))}
      </group>
    </>
  )
}

// A keeper, a helper or a sprout; which one is decided by the provider and the office bay.
export function GroveSpirit({ agent, skin, rosterIndex, rig }: RobotModelProps) {
  const castIndex = castIndexFor(agent, rosterIndex)
  const build = useMemo(() => spiritBuild(GROVE_CAST[castIndex]), [castIndex])
  const isAsking = moodFor(agent, false) === 'needs-you'
  return (
    <>
      <group ref={rig.base}>
        <Parts parts={build.joints.base} />
      </group>
      {/* Hidden, never unmounted: a merged batch keeps drawing a mesh that leaves the tree. */}
      <group name="needs-you-halo" visible={isAsking}>
        <UnitPart
          shape="cylinder"
          at={[0, HALO.y, 0]}
          size={[HALO.width, 0.006, HALO.width]}
          color={GROVE.beacon}
          glow
        />
      </group>
      <group ref={rig.body}>
        <group ref={rig.legs}>
          <Parts parts={build.joints.legs} />
        </group>
        <Parts parts={build.joints.body} />
        <group ref={rig.leftArm} position={build.pivot.leftArm}>
          <Parts parts={build.joints.leftArm} />
        </group>
        <group ref={rig.rightArm} position={build.pivot.rightArm}>
          <Parts parts={build.joints.rightArm} />
          <group name="needs-you-beacon" visible={isAsking}>
            <Parts parts={build.beacon} />
          </group>
        </group>
        <group ref={rig.gear} position={build.pivot.gear}>
          <Parts parts={build.joints.gear} />
        </group>
        <group ref={rig.head} position={build.pivot.head}>
          <Parts parts={build.joints.head} />
          {/* Sized geometry, not a unit part: the rig resets this mesh's scale to blink. */}
          <mesh ref={rig.eye} position={build.eye.at}>
            <boxGeometry args={build.eye.size} />
            <Matte color={skin.eye} glow />
          </mesh>
        </group>
        <GroveEffects rig={rig} crown={build.crown} />
      </group>
    </>
  )
}
