import { describe, expect, it } from 'vitest'
import type { LoungeGeometry } from '../../scene-model'
import type { PartSpec } from '../parts'
import { loungeParts, STOOL_HEIGHT } from './lounge-parts'
import { GARRISON } from './palette'
import { FLOORS } from './yard.test-utils'

// What the consoles already draw with, so the lounge adds no material of its own.
const DESK_COLORS = new Set<string>([
  GARRISON.gunmetal,
  GARRISON.steel,
  GARRISON.orange,
  GARRISON.hull,
  GARRISON.ice,
  GARRISON.navy
])
const WALK_CLEARANCE = 0.3
const FLAT = 0.05

const lounges = FLOORS.slice(0, 2).map((floor): LoungeGeometry => {
  const lounge = floor.zones[0].lounge
  if (!lounge) throw new Error('The fixture floor has no lounge')
  return lounge
})
const top = (part: PartSpec): number => part.at[1] + part.size[1] / 2
const local = (lounge: LoungeGeometry, point: { x: number; z: number }) => ({
  x: point.x - lounge.x,
  z: point.z - lounge.z
})

function covers(part: PartSpec, point: { x: number; z: number }, margin: number): boolean {
  return (
    Math.abs(part.at[0] - point.x) < part.size[0] / 2 + margin &&
    Math.abs(part.at[2] - point.z) < part.size[2] / 2 + margin
  )
}

describe.each(lounges.map((lounge) => [lounge.seats.length, lounge] as const))(
  'the mess deck with %i seats',
  (_seatCount, lounge) => {
    const parts = loungeParts(lounge)
    const seats = lounge.seats.map((seat) => local(lounge, seat))

    it('puts a stool under every seat', () => {
      for (const seat of seats) {
        const stools = parts.filter(
          (part) => covers(part, seat, 0) && top(part) <= STOOL_HEIGHT + 1e-9 && top(part) > 0.2
        )
        expect(stools.length).toBeGreaterThan(0)
      }
    })

    it('stands nothing where an agent sits or walks in from the door', () => {
      const door = local(lounge, lounge.door)
      const steps = seats.flatMap((seat) =>
        Array.from({ length: 41 }, (_, step) => ({
          x: door.x + ((seat.x - door.x) * step) / 40,
          z: door.z + ((seat.z - door.z) * step) / 40
        }))
      )
      const tall = parts.filter((part) => top(part) > STOOL_HEIGHT + 1e-9)
      expect(tall.length).toBeGreaterThan(10)
      for (const part of tall)
        for (const step of steps)
          expect(covers(part, step, WALK_CLEARANCE), JSON.stringify(part.at)).toBe(false)
    })

    it('keeps the stools low enough to step past and everything inside the lounge', () => {
      for (const part of parts) {
        if (top(part) > FLAT) {
          expect(Math.abs(part.at[0]) + part.size[0] / 2).toBeLessThanOrEqual(lounge.width / 2)
          expect(Math.abs(part.at[2]) + part.size[2] / 2).toBeLessThanOrEqual(lounge.depth / 2)
        }
        expect(part.at[1] - part.size[1] / 2).toBeGreaterThanOrEqual(0)
      }
    })

    it('is built from the boxes and colours the consoles already use', () => {
      for (const part of parts) {
        expect(part.shape).toBe('box')
        expect(part.rotation).toBeUndefined()
        expect(DESK_COLORS.has(part.color), part.color).toBe(true)
        if (part.glow) expect(part.color).toBe(GARRISON.ice)
      }
    })

    it('has a lit games table and a simulator pod as well as the seats', () => {
      expect(parts.filter((part) => part.glow).length).toBeGreaterThanOrEqual(3)
      expect(Math.max(...parts.map(top))).toBeGreaterThan(1)
    })
  }
)
