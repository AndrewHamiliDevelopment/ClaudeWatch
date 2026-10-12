import type { SteamStack } from '../themes/ambient-parts'
import type { PlacedLot } from '../themes/lot-kit'
import { draw } from '../themes/lot-math'
import type { PartSpec } from '../themes/parts'
import type { Vector } from '../themes/primitives'
import type { TownDress } from './town-dress'

const MAX_STACK_LOTS = 4
const STACK_DRAW = 70
const STEAM_RISE_M = 1.3
// Below this the puffs would start under the chimney's own top to stay within the lot's limit.
const MIN_RISE_M = 0.55

type Point = { x: number; y: number; z: number }

// A point of a lot's parts where the town draws it: turned with its lot, scaled, set on its base.
export function worldPoint(placed: PlacedLot, [x, y, z]: Vector): Vector {
  const [atX, atY, atZ] = placed.at
  const cos = Math.cos(placed.turn)
  const sin = Math.sin(placed.turn)
  return [
    atX + placed.scale * (x * cos + z * sin),
    atY + placed.scale * y,
    atZ + placed.scale * (-x * sin + z * cos)
  ]
}

export function topOf(placed: PlacedLot, { at: [x, y, z], size }: PartSpec): Point {
  const [worldX, worldY, worldZ] = worldPoint(placed, [x, y + size[1] / 2, z])
  return { x: worldX, y: worldY, z: worldZ }
}

// The highest point of what the town drew on a lot. A tilted part counts by its longest reach.
export function drawnTop(placed: PlacedLot): number {
  const tops = placed.parts.map(
    (part) =>
      placed.at[1] +
      placed.scale * (part.at[1] + (part.rotation ? Math.hypot(...part.size) : part.size[1]) / 2)
  )
  return Math.max(placed.at[1], ...tops)
}

// Steam off the chimneys of the few drawn lots whose design has one, picked by seed so they are
// the same every start. Each rises only as far as its lot's height limit allows.
export function townSteamStacks(placed: readonly PlacedLot[], dress: TownDress): SteamStack[] {
  const ventsOf = new Map(dress.designs.map((design) => [design.name, design.vents]))
  return placed
    .map((lot) => ({
      lot,
      stacks: (ventsOf.get(lot.design)?.(lot.parts) ?? []).flatMap((vent): SteamStack[] => {
        const top = topOf(lot, vent)
        const rise = Math.min(STEAM_RISE_M, lot.lot.maxHeight - top.y)
        return rise < MIN_RISE_M ? [] : [{ ...top, rise }]
      })
    }))
    .filter(({ stacks }) => stacks.length > 0)
    .sort((a, b) => draw(a.lot.lot.seed, STACK_DRAW) - draw(b.lot.lot.seed, STACK_DRAW))
    .slice(0, MAX_STACK_LOTS)
    .flatMap(({ stacks }) => stacks)
}
