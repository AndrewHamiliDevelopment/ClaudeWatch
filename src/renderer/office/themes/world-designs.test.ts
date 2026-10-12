import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { apronLots } from './apron'
import { BRASS_WORLD } from './BrassSurroundings'
import { EDO_WORLD } from './EdoSurroundings'
import type { Plot } from './lot-kit'
import { designFor, lotContents, plotOf, PROP_PLOT } from './lot-parts'
import type { PartSpec } from './parts'
import { lotBase, surroundingLots } from './surroundings'
import { APRON_TOP_Y, TOWN_APRON } from './town-apron'

// The box a part fills, with its rotation applied.
function boundsOf(part: PartSpec): Box3 {
  const matrix = new Matrix4().compose(
    new Vector3(...part.at),
    new Quaternion().setFromEuler(new Euler(...(part.rotation ?? [0, 0, 0]))),
    new Vector3(...part.size)
  )
  return new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix)
}

function boundsOfAll(parts: readonly PartSpec[]): Box3 {
  return parts.reduce((all, part) => all.union(boundsOf(part)), new Box3())
}

const EAVES_OVERHANG_M = 0.45
const FOOTPRINTS = [
  { width: 5, depth: 5 },
  { width: 7.5, depth: 6 },
  { width: 5.5, depth: 4 }
]
const floor = buildFixtureFrame(0, 0).floors[0]
const ringLots = surroundingLots(floor)

describe.each([
  ['Neo Edo Steam', EDO_WORLD],
  ['Brass Workshop', BRASS_WORLD]
])('%s lot designs', (_name, set) => {
  it('offers at least four buildings and six props, each its own design', () => {
    expect(set.buildings.length).toBeGreaterThanOrEqual(4)
    expect(set.props.length).toBeGreaterThanOrEqual(6)
    const names = [...set.buildings, ...set.props].map((design) => design.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has a building for the lowest lot the engine hands out', () => {
    expect(Math.min(...set.buildings.map((design) => design.minHeight))).toBeLessThanOrEqual(2)
  })

  it('keeps every building under its height limit and on its lot at any size', () => {
    for (const design of set.buildings) {
      for (const footprint of FOOTPRINTS) {
        for (const height of [design.minHeight, design.minHeight + 1.3, 6, 12, 24.5]) {
          if (height < design.minHeight) continue
          const plot: Plot = { ...footprint, height, seed: 7 }
          const bounds = boundsOfAll(design.parts(plot))
          const at = `${design.name} on ${footprint.width}x${footprint.depth}x${height}`
          expect(bounds.max.y, at).toBeLessThanOrEqual(height + 1e-6)
          expect(bounds.min.y, at).toBeGreaterThanOrEqual(-0.01)
          expect(bounds.max.x, at).toBeLessThanOrEqual(plot.width / 2 + EAVES_OVERHANG_M)
          expect(bounds.min.x, at).toBeGreaterThanOrEqual(-plot.width / 2 - EAVES_OVERHANG_M)
          expect(bounds.max.z, at).toBeLessThanOrEqual(plot.depth / 2 + EAVES_OVERHANG_M)
          expect(bounds.min.z, at).toBeGreaterThanOrEqual(-plot.depth / 2 - EAVES_OVERHANG_M)
        }
      }
    }
  })

  it('grows a tall design with its lot instead of stopping at one size', () => {
    const tallest = (height: number): number =>
      Math.max(
        ...set.buildings.map(
          (design) => boundsOfAll(design.parts({ width: 6, depth: 6, height, seed: 3 })).max.y
        )
      )
    expect(tallest(24.5)).toBeGreaterThan(tallest(6) + 4)
  })

  it('keeps every prop inside the spot props are drawn for', () => {
    const plot: Plot = {
      width: PROP_PLOT.length,
      depth: PROP_PLOT.reach,
      height: PROP_PLOT.height,
      seed: 5
    }
    for (const design of set.props) {
      const bounds = boundsOfAll(design.parts(plot))
      expect(bounds.max.y, design.name).toBeLessThanOrEqual(PROP_PLOT.height + 1e-6)
      expect(bounds.min.y, design.name).toBeGreaterThanOrEqual(-0.01)
      expect(bounds.max.x - bounds.min.x, design.name).toBeLessThanOrEqual(PROP_PLOT.length + 0.05)
      expect(bounds.max.z - bounds.min.z, design.name).toBeLessThanOrEqual(PROP_PLOT.reach + 0.05)
    }
  })

  it('costs at most seven kinds of part, so a filled world stays a handful of draws', () => {
    const kinds = new Set(
      [...set.buildings, ...set.props].flatMap((design) =>
        [2.5, 8, 24.5]
          .filter((height) => height >= design.minHeight)
          .flatMap((height) => design.parts({ width: 6, depth: 6, height, seed: 1 }))
          .map((part) => `${part.shape}:${part.color}:${part.glow ?? false}`)
      )
    )
    expect(kinds.size).toBeLessThanOrEqual(7)
  })

  it.each([
    ['the ring and the lanes', ringLots, (lot: (typeof ringLots)[0]) => lotBase(lot, floor)],
    ['the apron', apronLots(floor, TOWN_APRON), () => APRON_TOP_Y]
  ])('fills every lot on %s, under its limit, the same on every start', (_where, lots, baseOf) => {
    expect(lots.length).toBeGreaterThan(20)
    const drawn = new Set<string>()
    for (const lot of lots) {
      const baseY = baseOf(lot)
      const contents = lotContents(lot, baseY, set)
      expect(contents).toEqual(lotContents(lot, baseY, set))
      expect(contents.length).toBeGreaterThan(0)
      for (const placed of contents) {
        expect(placed.parts.length).toBeGreaterThan(0)
        const top = placed.at[1] + boundsOfAll(placed.parts).max.y * placed.scale
        expect(top, lot.id).toBeLessThanOrEqual(lot.maxHeight + 1e-6)
      }
      const designs = lot.kind === 'building' ? set.buildings : set.props
      const plot =
        lot.kind === 'building'
          ? plotOf(lot, baseY)
          : { ...plotOf(lot, baseY), height: PROP_PLOT.height }
      drawn.add(`${lot.kind}:${designFor(designs, plot).name}`)
    }
    const count = (kind: string): number =>
      [...drawn].filter((name) => name.startsWith(kind)).length
    expect(count('building')).toBeGreaterThanOrEqual(4)
    expect(count('prop')).toBeGreaterThanOrEqual(6)
  })
})
