import { Box3, Euler, Group, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { moveSteam } from '../themes/ambient-parts'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import type { PlacedLot } from '../themes/lot-kit'
import type { PartSpec } from '../themes/parts'
import { drawnTown, townDressOf as dressOfTheme } from './drawn-town.test-utils'
import { townSteamStacks } from './town-ambient'

const STEAMING: Record<string, readonly string[]> = {
  'neo-edo-steam': ['bathhouse', 'foundry with chimney'],
  'brass-workshop': ['foundry', 'boiler house']
}
const EPSILON = 1e-6
const PUFFS_PER_STACK = 3

// A part's top centre where the town draws it: turned with its lot, then lifted to the lot's base.
function worldTop(placed: PlacedLot, { at: [x, y, z], size }: PartSpec) {
  const [atX, atY, atZ] = placed.at
  const cos = Math.cos(placed.turn)
  const sin = Math.sin(placed.turn)
  return {
    x: atX + placed.scale * (x * cos + z * sin),
    y: atY + placed.scale * (y + size[1] / 2),
    z: atZ + placed.scale * (-x * sin + z * cos)
  }
}

// A part's box as drawn, so a part laid on its side counts by its real height.
function boundsOf({ at, size, rotation = [0, 0, 0] }: PartSpec): Box3 {
  const transform = new Matrix4().compose(
    new Vector3(...at),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...size)
  )
  return new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(transform)
}

describe.each(Object.keys(STEAMING))('%s steam on the zoned town', (themeId) => {
  const dress = dressOfTheme(themeId)
  const designByName = new Map(dress.designs.map((design) => [design.name, design]))

  it.each(LIVE_FLOORS)('rises off a chimney the town draws, on %s', (_name, floor) => {
    const placed = drawnTown(themeId, floor)
    const stacks = townSteamStacks(placed, dress)
    expect(stacks.length).toBeGreaterThan(0)
    for (const stack of stacks) {
      const under = placed.find(
        ({ lot }) =>
          Math.abs(stack.x - lot.x) <= lot.width / 2 && Math.abs(stack.z - lot.z) <= lot.depth / 2
      )
      expect(under, `stack at ${stack.x}, ${stack.z} stands on a lot`).toBeDefined()
      if (!under) continue
      expect(STEAMING[themeId]).toContain(under.design)
      const vents = designByName.get(under.design)?.vents?.(under.parts) ?? []
      const onTop = vents
        .map((vent) => worldTop(under, vent))
        .some(
          (top) =>
            Math.abs(top.x - stack.x) < EPSILON &&
            Math.abs(top.y - stack.y) < EPSILON &&
            Math.abs(top.z - stack.z) < EPSILON
        )
      expect(onTop, `stack on ${under.design} leaves the top of its chimney`).toBe(true)
    }
  })

  it.each(LIVE_FLOORS)('steams on a few lots, the same each start, on %s', (_name, floor) => {
    const placed = drawnTown(themeId, floor)
    const stacks = townSteamStacks(placed, dress)
    const lotsSteaming = new Set(
      stacks.map(
        (stack) =>
          placed.find(
            ({ lot }) =>
              Math.abs(stack.x - lot.x) <= lot.width / 2 &&
              Math.abs(stack.z - lot.z) <= lot.depth / 2
          )?.key
      )
    )
    expect(lotsSteaming.size).toBeLessThanOrEqual(4)
    expect(townSteamStacks(drawnTown(themeId, floor), dress)).toEqual(stacks)
  })

  it('keeps every puff under its lot limit', () => {
    const placed = drawnTown(themeId, LIVE_FLOORS[2][1])
    const stacks = townSteamStacks(placed, dress)
    const root = new Group()
    for (let index = 0; index < stacks.length * PUFFS_PER_STACK; index++) root.add(new Group())
    for (let step = 0; step < 120; step++) {
      moveSteam(root, stacks, step * 0.37)
      root.children.forEach((puff, index) => {
        const stack = stacks[Math.floor(index / PUFFS_PER_STACK)]
        expect(puff.position.y + puff.scale.y / 2).toBeLessThanOrEqual(stack.y + stack.rise + 1e-6)
        expect(puff.position.y).toBeGreaterThanOrEqual(stack.y)
      })
    }
  })
})

describe.each(Object.keys(STEAMING))('%s chimneys', (themeId) => {
  const vented = dressOfTheme(themeId).designs.filter((design) => design.vents)
  const PLOTS = [3, 5, 8, 12].flatMap((height) =>
    [1, 2, 3].map((seed) => ({ width: 7, depth: 6, height, seed, accent: '#123456' }))
  )

  it('are declared on the designs that draw one', () => {
    expect(vented.map((design) => design.name).sort()).toEqual([...STEAMING[themeId]].sort())
  })

  it.each(vented.map((design) => [design.name, design] as const))(
    'on the %s, sit on top of a narrow part nothing of the design covers',
    (_name, design) => {
      for (const plot of PLOTS.filter((each) => each.height >= design.height.min)) {
        const parts = design.build(plot)
        const vents = design.vents?.(parts) ?? []
        expect(vents.length).toBeGreaterThan(0)
        for (const vent of vents) {
          expect(parts).toContain(vent)
          expect(vent.rotation).toBeUndefined()
          expect(Math.max(vent.size[0], vent.size[2])).toBeLessThanOrEqual(1.2)
          const ventBox = boundsOf(vent)
          const isCovered = parts.some((part) => {
            const box = boundsOf(part)
            return (
              part !== vent &&
              box.max.y > ventBox.max.y + EPSILON &&
              box.max.x > ventBox.min.x + EPSILON &&
              box.min.x < ventBox.max.x - EPSILON &&
              box.max.z > ventBox.min.z + EPSILON &&
              box.min.z < ventBox.max.z - EPSILON
            )
          })
          expect(isCovered).toBe(false)
        }
      }
    }
  )
})
