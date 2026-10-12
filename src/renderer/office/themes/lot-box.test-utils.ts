import { expect } from 'vitest'
import { Euler, Matrix4 } from 'three'
import { makeFloor, makeZone } from '../__tests__/fixtures'
import type { FloorGeometry } from '../scene-model'
import type { PartSpec } from './parts'
import type { PlacedLot } from './lot-kit'

const EPSILON = 1e-6

// A floor of a given size with one company in the middle, for the apron around the plate.
export function compactFloor(width: number, depth: number): FloorGeometry {
  const project = makeZone({ id: 'c/p', kind: 'project', x: 0, z: 0, width: 14, depth: 10 })
  const company = makeZone({
    id: 'c',
    kind: 'company',
    companyKey: 'c',
    x: 0,
    z: 0,
    width: 22,
    depth: 18,
    door: { x: 0, z: 9 },
    children: [project]
  })
  return makeFloor({ floorId: `compact-${width}`, width, depth, zones: [company] })
}

// The world-space box of one part of a placed lot, its own rotation and the lot's turn applied.
function partBox(part: PartSpec, placed: PlacedLot) {
  const turn = new Matrix4().makeRotationFromEuler(new Euler(...(part.rotation ?? [0, 0, 0])))
  const half = [0, 1, 2].map((row) =>
    [0, 1, 2].reduce(
      (sum, column) => sum + Math.abs(turn.elements[column * 4 + row]) * (part.size[column] / 2),
      0
    )
  )
  const cos = Math.cos(placed.turn)
  const sin = Math.sin(placed.turn)
  const [x, y, z] = part.at
  return {
    x: placed.at[0] + (x * cos + z * sin) * placed.scale,
    z: placed.at[2] + (-x * sin + z * cos) * placed.scale,
    halfX: (Math.abs(cos) * half[0] + Math.abs(sin) * half[2]) * placed.scale,
    halfZ: (Math.abs(sin) * half[0] + Math.abs(cos) * half[2]) * placed.scale,
    top: placed.at[1] + (y + half[1]) * placed.scale
  }
}

export function topOf(placed: PlacedLot): number {
  return Math.max(...placed.parts.map((part) => partBox(part, placed).top))
}

export function expectInsideLot(placed: PlacedLot): void {
  const { lot } = placed
  expect(placed.parts.length, `${lot.id} is bare`).toBeGreaterThan(0)
  for (const part of placed.parts) {
    const box = partBox(part, placed)
    const where = `${placed.design} on ${lot.id}`
    expect(box.top, `${where} is too tall`).toBeLessThanOrEqual(lot.maxHeight + EPSILON)
    expect(Math.abs(box.x - lot.x) + box.halfX, `${where} is too wide`).toBeLessThanOrEqual(
      lot.width / 2 + EPSILON
    )
    expect(Math.abs(box.z - lot.z) + box.halfZ, `${where} is too deep`).toBeLessThanOrEqual(
      lot.depth / 2 + EPSILON
    )
  }
}
