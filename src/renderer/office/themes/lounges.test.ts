import { describe, expect, it } from 'vitest'
import type { LoungeGeometry } from '../scene-model'
import { brassLoungeParts } from './BrassLounge'
import { edoLoungeParts } from './EdoLounge'
import type { PartSpec } from './parts'

const WIDTH_M = 6
const SEAT_TOP_M = 0.3

// Laid out as the sim lays a lounge out: rows of four seats, 2 m apart, facing +z.
function lounge(seatCount: number, door: 'north' | 'south' | 'west' | 'east'): LoungeGeometry {
  const depth = 3 + Math.ceil(seatCount / 4) * 2
  const x = 20
  const z = -10
  const left = x - WIDTH_M / 2
  const top = z - depth / 2
  return {
    id: 'c:lounge',
    x,
    z,
    width: WIDTH_M,
    depth,
    door: {
      north: { x, z: top },
      south: { x, z: top + depth },
      west: { x: left, z },
      east: { x: left + WIDTH_M, z }
    }[door],
    seats: Array.from({ length: seatCount }, (_, index) => ({
      slotId: `lounge_seat_${index}`,
      x: left + 1.125 + (index % 4) * 1.25,
      z: top + 2 + Math.floor(index / 4) * 2,
      heading: 0
    }))
  }
}

const topOf = (part: PartSpec): number => part.at[1] + part.size[1] / 2

// How far a point on the floor is from a part's footprint.
function gap(part: PartSpec, x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x - part.at[0]) - part.size[0] / 2)
  const dz = Math.max(0, Math.abs(z - part.at[2]) - part.size[2] / 2)
  return Math.hypot(dx, dz)
}

// Points an agent's body passes: its seat, and the straight walk there from the door.
function walked(geometry: LoungeGeometry): { x: number; z: number }[] {
  return geometry.seats.flatMap((seat) =>
    Array.from({ length: 41 }, (_, step) => ({
      x: geometry.door.x + ((seat.x - geometry.door.x) * step) / 40,
      z: geometry.door.z + ((seat.z - geometry.door.z) * step) / 40
    }))
  )
}

const CASES = [4, 8, 12].flatMap((seatCount) =>
  (['north', 'south', 'west', 'east'] as const).map((door) => lounge(seatCount, door))
)

describe.each([
  ['Neo Edo Steam tea deck', edoLoungeParts],
  ['Brass Workshop canteen', brassLoungeParts]
])('%s', (_name, partsOf) => {
  it('puts something low to sit on at every seat', () => {
    for (const geometry of CASES) {
      const parts = partsOf(geometry)
      for (const seat of geometry.seats) {
        const seatParts = parts.filter(
          (part) =>
            Math.hypot(part.at[0] - seat.x, part.at[2] - seat.z) < 0.05 &&
            topOf(part) > 0.05 &&
            topOf(part) <= SEAT_TOP_M
        )
        expect(seatParts.length, `${geometry.seats.length} seats`).toBeGreaterThan(0)
      }
    }
  })

  it('stands nothing where an agent sits or walks in from the door', () => {
    for (const geometry of CASES) {
      const standing = partsOf(geometry).filter((part) => topOf(part) > SEAT_TOP_M)
      for (const point of walked(geometry))
        for (const part of standing) expect(gap(part, point.x, point.z)).toBeGreaterThan(0.4)
    }
  })

  it('keeps its furniture inside the lounge, and is furnished wherever the door is', () => {
    for (const geometry of CASES) {
      const parts = partsOf(geometry)
      for (const part of parts) {
        expect(Math.abs(part.at[0] - geometry.x) + part.size[0] / 2).toBeLessThanOrEqual(
          geometry.width / 2 + 1e-6
        )
        expect(Math.abs(part.at[2] - geometry.z) + part.size[2] / 2).toBeLessThanOrEqual(
          geometry.depth / 2 + 1e-6
        )
      }
      expect(parts.filter((part) => topOf(part) > 0.6).length).toBeGreaterThan(0)
    }
  })

  it('draws the same lounge on every start', () => {
    expect(partsOf(CASES[0])).toEqual(partsOf(CASES[0]))
  })
})
