import { isValidElement, type ReactNode, type RefObject } from 'react'
import { Group, Mesh } from 'three'
import { directChildren } from './scene.test-utils'
import type { Vector } from './primitives'
import type { RobotRig } from './types'

interface Placement {
  args?: readonly unknown[]
  children?: ReactNode
  position?: Vector
  rotation?: Vector
  scale?: Vector | number
  ref?: RefObject<Group | Mesh | null>
}

function placementOf(node: ReactNode): Placement {
  return isValidElement<Placement>(node) ? node.props : {}
}

export function emptyRig(): RobotRig {
  const group = (): RefObject<Group | null> => ({ current: null })
  const mesh = (): RefObject<Mesh | null> => ({ current: null })
  return {
    base: group(),
    body: group(),
    head: group(),
    legs: group(),
    leftArm: group(),
    rightArm: group(),
    gear: group(),
    sensor: group(),
    eye: mesh(),
    thought: group(),
    puffs: [mesh(), mesh(), mesh()]
  }
}

// Uses the real expanded model tree, including parent transforms and animation ref attachment.
export function mountFigure(node: ReactNode): Group {
  const root = new Group()
  for (const child of directChildren(node)) {
    const object = child.type === 'mesh' ? new Mesh() : mountFigure(child.props.children)
    const { position, rotation, scale, ref } = placementOf(child)
    if (position) object.position.set(...position)
    if (rotation) object.rotation.set(...rotation)
    if (typeof scale === 'number') object.scale.setScalar(scale)
    else if (scale) object.scale.set(...scale)
    if (ref) ref.current = object
    root.add(object)
  }
  root.updateMatrixWorld(true)
  return root
}

export function silhouette(node: ReactNode): string {
  return JSON.stringify(
    directChildren(node).map((child) => {
      const props = placementOf(child)
      return [
        child.type,
        props.position,
        props.rotation,
        props.scale,
        typeof child.type === 'string' && child.type.endsWith('Geometry') ? child.props.args : null,
        silhouette(child.props.children)
      ]
    })
  )
}
