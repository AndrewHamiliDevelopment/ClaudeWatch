import { describe, expect, it } from 'vitest'
import { makeGeometry } from '../geometry-audit.test-utils'
import { UNIT_SHAPES, type UnitShape } from '../unit-parts'
import { COURT_CAST } from './cast'
import { frameParts } from './frame-parts'
import { COURT } from './palette'
import type { PartSpec } from '../parts'
import { pilotParts } from './pilot-parts'
import { COURT_FRAMES, type FrameKind } from './roster'

const PALETTE = new Set<string>(Object.values(COURT))

function triangles(shape: UnitShape): number {
  const element = UNIT_SHAPES[shape]
  const geometry = makeGeometry(String(element.type), element.props.args)
  return (geometry.index?.count ?? geometry.attributes.position.count) / 3
}

function expectBuildable(parts: readonly PartSpec[]): void {
  expect(parts.length).toBeGreaterThan(8)
  for (const part of parts) {
    // A colour outside the palette is a new material, which is a new draw call.
    expect(PALETTE.has(part.color), `${part.color} is not a Violet Court colour`).toBe(true)
    for (const length of part.size) expect(length).toBeGreaterThan(0)
  }
  // The shared budget test caps a whole model at 2500; the eye and steam effects take about 600.
  expect(parts.reduce((sum, part) => sum + triangles(part.shape), 0)).toBeLessThanOrEqual(1900)
}

describe('Violet Court figures', () => {
  it('builds every pilot from palette-coloured unit parts on every rig joint', () => {
    for (const character of COURT_CAST) {
      const joints = pilotParts(character)
      for (const joint of ['base', 'legs', 'body', 'leftArm', 'rightArm', 'head', 'gear'] as const)
        expect(joints[joint].length, `${character.id} ${joint}`).toBeGreaterThan(0)
      expectBuildable(Object.values(joints).flat())
    }
  })

  it('gives every character its own silhouette', () => {
    const shapes = COURT_CAST.map((character) => JSON.stringify(pilotParts(character)))
    expect(new Set(shapes).size).toBe(COURT_CAST.length)
  })

  it('dresses the Order and the Corps in different jackets, and only the Guild in a tabard', () => {
    const jackets = (faction: 'order' | 'corps') =>
      COURT_CAST.filter((character) => character.faction === faction).map(
        (character) => pilotParts(character).body[0].color
      )
    for (const color of jackets('order')) expect(jackets('corps')).not.toContain(color)
    for (const character of COURT_CAST)
      expect(character.features.includes('tabard'), character.id).toBe(
        character.faction === 'guild'
      )
  })

  it('builds three different knight frames, each taller than a pilot', () => {
    const builds = COURT_FRAMES.map((frame) => frameParts(frame.kind))
    for (const parts of builds) {
      expectBuildable(parts)
      expect(Math.max(...parts.map((part) => part.at[1] + part.size[1] / 2))).toBeGreaterThan(1.9)
    }
    expect(new Set(builds.map((parts) => JSON.stringify(parts))).size).toBe(3)
  })

  // An original silhouette: no frame has one oversized arm.
  it.each<FrameKind>(['command', 'vanguard', 'lancer'])('builds %s with matched arms', (kind) => {
    const widestForearm = (side: -1 | 1) =>
      Math.max(
        ...frameParts(kind)
          .filter((part) => Math.sign(part.at[0]) === side && part.at[1] > 0.8 && part.at[1] < 1.3)
          .filter((part) => Math.abs(part.at[0]) > 0.3 && Math.abs(part.at[0]) < 0.5)
          .map((part) => part.size[0])
      )
    expect(widestForearm(-1)).toBeCloseTo(widestForearm(1))
  })
})
