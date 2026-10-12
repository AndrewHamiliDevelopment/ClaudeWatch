import { Color } from 'three'
import type { Rect } from '../themes/lot-math'
import { GROUND_Y } from '../themes/surroundings'
import type { TownDress } from './town-dress'
import { SIDEWALK_M } from './town-grid'
import type { TownPlan } from './town-plan'
import { campusStreet, plazaSquare } from './town-plaza'
import { roadPromenades, type TownRoad } from './town-roads'

// Lowest first: a later layer lies over an earlier one wherever they meet.
const LAYERS = ['pad', 'campus', 'street', 'sidewalk', 'carriageway', 'promenade'] as const
export type GroundLayer = (typeof LAYERS)[number]

export interface GroundQuad extends Rect {
  layer: GroundLayer
  y: number
  color: string
}

// Far enough apart for the depth buffer at the widest zoom, and too little to see as a step.
const LAYER_LIFT_M = 0.01
const CORNERS_PER_QUAD = 6

function quad(layer: GroundLayer, rect: Rect, color: string): GroundQuad {
  const { x, z, width, depth } = rect
  return {
    layer,
    x,
    z,
    width,
    depth,
    y: GROUND_Y + (LAYERS.indexOf(layer) + 1) * LAYER_LIFT_M,
    color
  }
}

// The ground a road covers, `inset` in from each kerb. A boulevard strip runs corner to corner
// of its centre line, so it is carried on to square the corner off.
function strip(road: TownRoad, inset: number): Rect {
  const overrun = road.class === 'boulevard' ? road.width / 2 - inset : 0
  const across = road.width - inset * 2
  const isAlongX = road.from.z === road.to.z
  const [from, to] = isAlongX ? [road.from.x, road.to.x] : [road.from.z, road.to.z]
  const along = Math.abs(to - from) + overrun * 2
  return {
    x: (road.from.x + road.to.x) / 2,
    z: (road.from.z + road.to.z) / 2,
    width: isAlongX ? along : across,
    depth: isAlongX ? across : along
  }
}

// Everything underfoot in the town, as flat rectangles: a pad per block in its zone's colour,
// the campus over the part of a block the claim cuts, then roads, walks and the gate plaza.
export function groundQuads(plan: TownPlan, dress: TownDress): GroundQuad[] {
  const { roads } = dress
  return [
    ...plan.blocks.map((block) => quad('pad', block, dress.looks[block.zone].ground)),
    quad('campus', plan.claim, dress.looks.park.ground),
    quad('street', campusStreet(plan.claim), roads.sidewalk),
    ...plan.roads.map((road) => quad('sidewalk', strip(road, 0), roads.sidewalk)),
    ...plan.roads
      .filter((road) => road.class !== 'lane')
      .map((road) => quad('carriageway', strip(road, SIDEWALK_M[road.class]), roads.carriageway)),
    ...roadPromenades(plan.roads, plan.claim).map((walk) =>
      quad('promenade', walk, roads.promenade)
    ),
    quad('promenade', plazaSquare(plan.claim), roads.promenade)
  ]
}

// Two triangles a quad, wound to face up, with its colour at every corner: one mesh, one draw.
export function groundBuffers(quads: readonly GroundQuad[]): {
  positions: Float32Array
  colors: Float32Array
} {
  const positions = new Float32Array(quads.length * CORNERS_PER_QUAD * 3)
  const colors = new Float32Array(positions.length)
  const color = new Color()
  quads.forEach(({ x, y, z, width, depth, color: hex }, index) => {
    const west = x - width / 2
    const east = x + width / 2
    const north = z - depth / 2
    const south = z + depth / 2
    const offset = index * CORNERS_PER_QUAD * 3
    // prettier-ignore
    positions.set([
      west, y, north,  west, y, south,  east, y, south,
      west, y, north,  east, y, south,  east, y, north
    ], offset)
    color.set(hex)
    for (let corner = 0; corner < CORNERS_PER_QUAD; corner++)
      color.toArray(colors, offset + corner * 3)
  })
  return { positions, colors }
}
