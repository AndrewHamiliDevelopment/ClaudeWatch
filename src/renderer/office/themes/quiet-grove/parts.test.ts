import { describe, expect, it } from 'vitest'
import { makeGeometry } from '../geometry-audit.test-utils'
import { UNIT_SHAPES, type UnitShape } from '../unit-parts'
import type { PartSpec } from '../parts'
import { GROVE_CAST, type GroveCharacter } from './cast'
import { GROVE } from './palette'
import { spiritBuild } from './spirit-parts'

const PALETTE = new Set<string>(Object.values(GROVE))
// The shared budget test caps a model at 2500; the eye, fireflies and thought dots take about 620.
const FIGURE_TRIANGLE_CAP = 1800

function triangles(shape: UnitShape): number {
  const element = UNIT_SHAPES[shape]
  const geometry = makeGeometry(String(element.type), element.props.args)
  return (geometry.index?.count ?? geometry.attributes.position.count) / 3
}

const everyPart = (who: GroveCharacter): PartSpec[] => {
  const build = spiritBuild(who)
  return [...Object.values(build.joints).flat(), ...build.beacon]
}
const top = (parts: readonly PartSpec[], lift = 0): number =>
  Math.max(...parts.map((part) => lift + part.at[1] + part.size[1] / 2))

function height(who: GroveCharacter): number {
  const build = spiritBuild(who)
  return Math.max(top(build.joints.body), top(build.joints.head, build.pivot.head[1]))
}

const heights = (kin: GroveCharacter['kin'], isSprout: boolean): number[] =>
  GROVE_CAST.filter((who) => who.kin === kin && who.isSprout === isSprout).map(height)

describe('Quiet Grove figures', () => {
  it('builds every character from palette-coloured unit parts inside the triangle cap', () => {
    for (const character of GROVE_CAST) {
      const { joints } = spiritBuild(character)
      for (const joint of ['base', 'body', 'leftArm', 'rightArm', 'head', 'gear'] as const)
        expect(joints[joint].length, `${character.id} ${joint}`).toBeGreaterThan(0)
      const parts = everyPart(character)
      for (const part of parts) {
        // A colour outside the palette is a new material, which is a new draw call.
        expect(PALETTE.has(part.color), `${part.color} is not a Quiet Grove colour`).toBe(true)
        for (const length of part.size) expect(length).toBeGreaterThan(0)
      }
      expect(
        parts.reduce((sum, part) => sum + triangles(part.shape), 0),
        character.id
      ).toBeLessThanOrEqual(FIGURE_TRIANGLE_CAP)
    }
  })

  it('gives every character its own silhouette', () => {
    const shapes = GROVE_CAST.map((character) => JSON.stringify(spiritBuild(character).joints))
    expect(new Set(shapes).size).toBe(GROVE_CAST.length)
  })

  it('keeps the keepers warm and the helpers cool, with no body colour in common', () => {
    const bodies = (kin: GroveCharacter['kin']) =>
      GROVE_CAST.filter((character) => character.kin === kin && !character.isSprout).map(
        (character) => spiritBuild(character).joints.body[0].color
      )
    for (const color of bodies('keeper')) expect(bodies('helper')).not.toContain(color)
  })

  it('stands a keeper taller than a helper, and both taller than a sprout', () => {
    const tallestHelper = Math.max(...heights('helper', false))
    expect(Math.min(...heights('keeper', false))).toBeGreaterThan(tallestHelper)
    const shortestHelper = Math.min(...heights('helper', false))
    expect(shortestHelper).toBeGreaterThan(Math.max(...heights('keeper', true)))
    expect(shortestHelper).toBeGreaterThan(Math.max(...heights('helper', true)))
  })

  // Needs-you must never be subtle: the beacon is the largest glowing part a figure carries.
  it('carries a glowing needs-you beacon no resting part shares a colour with', () => {
    for (const character of GROVE_CAST) {
      const build = spiritBuild(character)
      const lamp = build.beacon.find((part) => part.color === GROVE.beacon)
      expect(lamp?.glow, character.id).toBe(true)
      expect(lamp?.size[0]).toBeGreaterThan(build.eye.size[0])
      const restingColours = Object.values(build.joints)
        .flat()
        .map((part) => part.color)
      expect(restingColours, character.id).not.toContain(GROVE.beacon)
    }
  })
})
