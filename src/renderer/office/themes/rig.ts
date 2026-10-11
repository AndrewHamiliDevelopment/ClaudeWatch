import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { steamPuffs, type RobotMood, type RobotPose } from '../logic/character-pose'
import type { RobotRig } from './types'

export function useRobotRig(): RobotRig {
  return {
    body: useRef<Group>(null),
    head: useRef<Group>(null),
    leftArm: useRef<Group>(null),
    rightArm: useRef<Group>(null),
    gear: useRef<Group>(null),
    legs: useRef<Group>(null),
    base: useRef<Group>(null),
    sensor: useRef<Group>(null),
    eye: useRef<Mesh>(null),
    thought: useRef<Group>(null),
    puffs: [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)]
  }
}

export function applyThemePose(
  rig: RobotRig,
  pose: RobotPose,
  options: {
    mood: RobotMood
    time: number
    phase: number
    delta: number
    isReducedMotion: boolean
  }
): void {
  if (rig.body.current) {
    rig.body.current.position.y = pose.bob
    rig.body.current.rotation.z = pose.sway
  }
  rig.head.current?.rotation.set(pose.headPitch, 0, 0)
  rig.leftArm.current?.rotation.set(pose.leftArm, 0, 0)
  rig.rightArm.current?.rotation.set(pose.rightArm, 0, pose.rightArmRoll)
  if (rig.gear.current) rig.gear.current.rotation.z += pose.gearSpeed * options.delta
  rig.eye.current?.scale.set(1, pose.eyeOpen, 1)
  if (rig.thought.current) rig.thought.current.visible = options.mood === 'thinking'
  const puffs =
    options.mood === 'working' && !options.isReducedMotion
      ? steamPuffs(options.time, options.phase)
      : []
  rig.puffs.forEach((ref, index) => {
    const mesh = ref.current
    if (!mesh) return
    const puff = puffs[index]
    mesh.visible = Boolean(puff && puff.opacity > 0)
    if (!puff || !mesh.visible) return
    mesh.position.y = 1.12 + puff.y
    mesh.scale.setScalar(puff.scale)
  })
}
