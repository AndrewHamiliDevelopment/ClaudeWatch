import { describe, expect, it } from 'vitest'
import { makeGeometry } from '../geometry-audit.test-utils'
import { UNIT_SHAPES, type UnitShape } from '../unit-parts'
import type { PartSpec } from '../parts'
import { GARRISON_CAST } from './cast'
import { crewParts } from './crew-parts'
import { BRIDGE, frameParts, GANTRY } from './frame-parts'
import { GARRISON } from './palette'
import { GARRISON_FRAMES, type FrameKind } from './roster'

const PALETTE = new Set<string>(Object.values(GARRISON))
const KINDS: FrameKind[] = ['trooper', 'heavy', 'scout']
const top = (part: PartSpec): number => part.at[1] + part.size[1] / 2

function triangles(shape: UnitShape): number {
  const element = UNIT_SHAPES[shape]
  const geometry = makeGeometry(String(element.type), element.props.args)
  return (geometry.index?.count ?? geometry.attributes.position.count) / 3
}

function expectBuildable(parts: readonly PartSpec[]): void {
  expect(parts.length).toBeGreaterThan(8)
  for (const part of parts) {
    // A colour outside the palette is a new material, which is a new draw call.
    expect(PALETTE.has(part.color), `${part.color} is not a Garrison colour`).toBe(true)
    for (const length of part.size) expect(length).toBeGreaterThan(0)
  }
  // The shared budget test caps a whole model at 2500; the eye and steam effects take about 600.
  expect(parts.reduce((sum, part) => sum + triangles(part.shape), 0)).toBeLessThanOrEqual(1900)
}

describe('Orbital Garrison crew', () => {
  it('builds every character from palette-coloured unit parts on every rig joint', () => {
    for (const character of GARRISON_CAST) {
      const joints = crewParts(character)
      for (const joint of ['base', 'legs', 'body', 'leftArm', 'rightArm', 'head', 'gear'] as const)
        expect(joints[joint].length, `${character.id} ${joint}`).toBeGreaterThan(0)
      expectBuildable(Object.values(joints).flat())
    }
  })

  it('gives every character its own silhouette', () => {
    const shapes = GARRISON_CAST.map((character) => JSON.stringify(crewParts(character)))
    expect(new Set(shapes).size).toBe(GARRISON_CAST.length)
  })

  it('dresses the flight wing and the deck crew in different suit colours', () => {
    const suits = (section: 'wing' | 'deck') =>
      GARRISON_CAST.filter((character) => character.section === section).map(
        (character) => crewParts(character).body[0].color
      )
    expect(new Set(suits('wing')).size).toBe(1)
    for (const color of suits('wing')) expect(suits('deck')).not.toContain(color)
  })
})

describe('Orbital Garrison frames', () => {
  it('builds three different mobile frames, each taller than a pilot', () => {
    const builds = GARRISON_FRAMES.map((frame) => frameParts(frame.kind))
    for (const parts of builds) {
      expectBuildable(parts)
      expect(Math.max(...parts.map(top))).toBeGreaterThan(1.9)
    }
    expect(new Set(builds.map((parts) => JSON.stringify(parts))).size).toBe(3)
  })

  it('paints each frame in its own armour colour', () => {
    const armours = KINDS.map((kind) => frameParts(kind).find((part) => part.at[1] > 1.5)?.color)
    expect(new Set(armours).size).toBe(3)
  })

  it.each(KINDS)('builds %s with matched arms', (kind) => {
    const armWidths = (side: -1 | 1) =>
      frameParts(kind)
        .filter((part) => part.at[0] * side > 0.4 && part.at[0] * side < 0.48)
        .map((part) => part.size[0])
        .sort()
    expect(armWidths(-1).length).toBeGreaterThanOrEqual(4)
    expect(armWidths(-1)).toEqual(armWidths(1))
  })

  // An original silhouette: a flat band visor, and no ball, horn, crest or spike anywhere.
  it.each(KINDS)('gives %s a band visor and no round or pointed head parts', (kind) => {
    const parts = frameParts(kind)
    expect(parts.filter((part) => part.shape === 'sphere')).toEqual([])
    expect(parts.filter((part) => part.shape === 'cone' && top(part) > 1.5)).toEqual([])
    const lit = parts.filter((part) => part.glow)
    expect(lit).toHaveLength(1)
    expect(lit[0].shape).toBe('box')
    expect(lit[0].size[0]).toBeGreaterThan(lit[0].size[1] * 3)
  })

  it('builds the gantry and the bridge from the same palette', () => {
    expectBuildable(GANTRY)
    expectBuildable(BRIDGE)
  })
})
