import { createElement, type ReactNode } from 'react'
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { expect } from 'vitest'
import { plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { InstancedParts } from '../scene/InstancedParts'
import type { InstancePlacement } from '../scene/instancing'
import { makeGeometry } from './geometry-audit.test-utils'
import type { Rect } from './lot-math'
import { directChildren, type SceneElement } from './scene.test-utils'
import { gapBetween, HEIGHT_PER_METRE, officesOf, surroundingLots } from './surroundings'
import type { OfficeTheme } from './types'

type Triple = [number, number, number]
interface Placement {
  position?: Triple
  rotation?: Triple
  scale?: Triple | number
  placements?: readonly InstancePlacement[]
}

// The footprint and height of one drawn mesh or instance, in floor coordinates.
export interface DrawnBox extends Rect {
  top: number
}

function matrixOf(position: Triple, rotation: Triple, scale: Triple): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale)
  )
}

function localMatrix({ position, rotation, scale }: Placement): Matrix4 {
  const size: Triple = typeof scale === 'number' ? [scale, scale, scale] : (scale ?? [1, 1, 1])
  return matrixOf(position ?? [0, 0, 0], rotation ?? [0, 0, 0], size)
}

function shapeOf(element: SceneElement): Box3 | null {
  const part = directChildren(element.props.children).find(
    (child) => typeof child.type === 'string' && child.type.endsWith('Geometry')
  )
  if (!part || typeof part.type !== 'string') return null
  const geometry = makeGeometry(
    part.type,
    (part.props.args ?? []).map((value) => (typeof value === 'number' ? value : undefined))
  )
  geometry.computeBoundingBox()
  return geometry.boundingBox
}

function drawn(shape: Box3, world: Matrix4): DrawnBox {
  const { min, max } = shape.clone().applyMatrix4(world)
  return {
    x: (min.x + max.x) / 2,
    z: (min.z + max.z) / 2,
    width: max.x - min.x,
    depth: max.z - min.z,
    top: max.y
  }
}

// Every mesh and instance under `node`, with its groups' positions, turns and scales applied.
function drawnBoxes(node: ReactNode, parent = new Matrix4()): DrawnBox[] {
  return directChildren(node).flatMap((child): DrawnBox[] => {
    const placement = child.props as Placement
    const shape = shapeOf(child)
    if (child.type === InstancedParts)
      return (placement.placements ?? []).flatMap((instance) => {
        const { x, y, z, rotationY, scaleX = 1, scaleY = 1, scaleZ = 1 } = instance
        const local = matrixOf([x, y, z], [0, rotationY, 0], [scaleX, scaleY, scaleZ])
        return shape ? [drawn(shape, parent.clone().multiply(local))] : []
      })
    const world = parent.clone().multiply(localMatrix(placement))
    if (child.type === 'mesh') return shape ? [drawn(shape, world)] : []
    return drawnBoxes(child.props.children, world)
  })
}

// What a theme draws on a floor, as the scene mounts it: the district at the plate centre and
// measured from there, the surroundings and the lounges in the floor's own coordinates.
export function themeBoxes(theme: OfficeTheme, floor: FloorGeometry) {
  const { Surroundings, Lounge } = theme.kit.zone
  const lots = surroundingLots(floor)
  const lounges = floor.zones.flatMap((zone) => (zone.lounge ? [zone.lounge] : []))
  return {
    lots,
    lounges,
    district: drawnBoxes(
      createElement(
        'group',
        { position: [floor.x, 0, floor.z] },
        createElement(theme.world.District, { floor: plateLocalFloor(floor) })
      )
    ),
    surroundings: Surroundings ? drawnBoxes(createElement(Surroundings, { floor, lots })) : [],
    lounge: lounges.map((lounge) => (Lounge ? drawnBoxes(createElement(Lounge, { lounge })) : []))
  }
}

const round = (metres: number): number => Math.round(metres * 100) / 100

// The rule every lot is limited by: a thing's top is at most 0.7 x its distance to the nearest
// office, so it hides no desk at any map rotation.
export function expectNoDeskHidden(boxes: readonly DrawnBox[], floor: FloorGeometry): void {
  const offices = officesOf(floor)
  const tooTall = boxes.flatMap((box) => {
    const gap = Math.min(...offices.map((office) => gapBetween(box, office)))
    const limit = gap * HEIGHT_PER_METRE
    return box.top > limit + 1e-6
      ? [`top ${round(box.top)} over ${round(limit)} at ${round(box.x)}, ${round(box.z)}`]
      : []
  })
  expect(tooTall).toEqual([])
}
