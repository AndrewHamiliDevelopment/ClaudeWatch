import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { Group, Mesh, MeshStandardMaterial } from 'three'
import { expect, it } from 'vitest'
import { createMeshBatches } from '../scene/mesh-batches'
import { makeGeometry } from './geometry-audit.test-utils'
import { UNIT_SHAPES, UnitPart, type UnitShape } from './unit-parts'
import type { Vector } from './primitives'

interface PartProps {
  children?: ReactNode
  args?: number[]
  scale?: Vector
  position?: Vector
}

function partsOf(element: ReactElement<PartProps>) {
  const children = (Array.isArray(element.props.children) ? element.props.children : []).filter(
    (child): child is ReactElement<PartProps> => isValidElement<PartProps>(child)
  )
  const geometry = children.find((child) => String(child.type).endsWith('Geometry'))
  if (!geometry) throw new Error('A unit part must carry a geometry')
  return { kind: String(geometry.type), args: geometry.props.args ?? [] }
}

it('carries its size in the mesh scale so every size shares one geometry', () => {
  for (const shape of Object.keys(UNIT_SHAPES) as UnitShape[]) {
    const small = UnitPart({ shape, size: [0.2, 0.4, 0.1], color: '#123456' })
    const large = UnitPart({ shape, at: [1, 2, 3], size: [2, 3, 4], color: '#123456' })
    expect(partsOf(small)).toEqual(partsOf(large))
    expect(small.props.scale).toEqual([0.2, 0.4, 0.1])
    expect(large.props.scale).toEqual([2, 3, 4])
    expect(large.props.position).toEqual([1, 2, 3])
  }
})

function figure(sizes: readonly Vector[]): Mesh[] {
  return sizes.map((size) => {
    const { kind, args } = partsOf(UnitPart({ shape: 'box', size, color: '#123456' }))
    const mesh = new Mesh(makeGeometry(kind, args), new MeshStandardMaterial({ color: '#123456' }))
    mesh.scale.set(...size)
    return mesh
  })
}

it('merges two figures with different part sizes into as many draws as one figure', () => {
  const root = new Group()
  root.add(
    ...figure([
      [0.3, 0.5, 0.2],
      [0.1, 0.4, 0.1]
    ]),
    ...figure([
      [0.6, 0.9, 0.4],
      [0.2, 0.2, 0.7]
    ])
  )
  const batches = createMeshBatches(root)
  expect(batches).toHaveLength(1)
  expect(batches[0].mesh.count).toBe(4)
})
