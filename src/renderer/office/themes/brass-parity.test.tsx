import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { BrassRoomDressing, BrassDesk } from './BrassKit'
import { makeRoom } from '../__tests__/fixtures'
import { deskSlots } from '../logic/room-layout'

it('keeps the original boiler opposite the doorway rather than always in the same corner', () => {
  const room = makeRoom({ id: 'r1', x: 0, z: -4, door: { x: 0, z: -1.5 } })
  const dressing = BrassRoomDressing({ room })
  expect(dressing.props.position[0]).toBeCloseTo(room.width / 2 - 0.55)
  expect(dressing.props.position[1]).toBe(0)
  expect(dressing.props.position[2]).toBeCloseTo(room.z - room.depth / 2 + 0.55)
})

function geometry(node: ReactNode): React.ReactElement<{ args: number[] }>[] {
  if (Array.isArray(node)) return node.flatMap(geometry)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  return [
    ...(node.type === 'cylinderGeometry' && isValidElement<{ args: number[] }>(node) ? [node] : []),
    ...geometry(node.props.children)
  ]
}

it('preserves the tapered brass stool and lamp proportions', () => {
  const room = makeRoom({ id: 'r1' })
  const shapes = geometry(BrassDesk({ room, slot: deskSlots(room)[0] })).map(
    (node) => node.props.args
  )
  expect(shapes).toContainEqual([0.2, 0.16, 0.32, 10])
  expect(shapes).toContainEqual([0.02, 0.05, 0.36, 6])
})
