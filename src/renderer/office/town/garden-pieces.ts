import type { WallSide } from '../logic/room-layout'
import type { PlacedLot } from '../themes/lot-kit'
import { gapBetween, hashOf, type Rect } from '../themes/lot-math'
import { HEIGHT_PER_METRE, heightLimit, type Lot, type Site } from '../themes/surroundings'
import {
  dressLot,
  type GardenRole,
  type TownDress,
  type ZoneDesign,
  type ZoneProp
} from './town-dress'
import { box, cylinder, sphere } from '../themes/parts'
import { MIN_BELT_M } from './town-grid'
import { ZONE_HEIGHT_CAP_M } from './town-zones'

// A piece of the campus garden or the gate plaza, placed by rule and drawn by its role's name.
export interface GreenPlot extends Lot {
  zone: 'park'
  facing: WallSide
  isLandmark: false
  role: PieceRole
}

// The named roles, and the hedge that edges the lawn: one stretched box, never a pick.
export type PieceRole = GardenRole | 'hedge'

// Rows stand against the inner edge of the 3 m of belt the claim always has, as far from the
// promenade as they can be and so as tall as the height rule lets them.
export const ROW_ACROSS_M = 0.8
export const ROW_DEPTH_M = MIN_BELT_M - ROW_ACROSS_M / 2 - 0.1

const BUILT_ROLES: readonly PieceRole[] = ['feature', 'corner', 'innerTree', 'hedge']
const isBuilt = (role: PieceRole): boolean => BUILT_ROLES.includes(role)

// The tree a theme with no tree design of its own plants in its inner avenue.
export const GARDEN_TREE = 'garden tree'
const HEDGE_M = 0.5

// What a theme with no `garden` of its own takes for each role, by the piece's name.
const NAME_FITS: Record<GardenRole, RegExp> = {
  tree: /tree|pine|sapling|topiary|planter/,
  lamp: /lamp|lantern|light/,
  seat: /bench|seat/,
  plazaPair: /statue|lantern|planter|pennant|banner/,
  feature: /pond|fountain|garden|parterre|lawn|bandstand/,
  corner: /pine|grove|stand|tree|lawn/,
  innerTree: /tree|pine|grove/
}

interface Placing {
  facing: WallSide
  zoneId: string | null
  maxHeight: number
}

// One seed per role, so every piece of a role is built the same.
export function gardenPiece(id: string, role: PieceRole, rect: Rect, placing: Placing): GreenPlot {
  const { x, z, width, depth } = rect
  return {
    id,
    kind: isBuilt(role) ? 'building' : 'prop',
    x,
    z,
    width,
    depth,
    seed: hashOf(`garden:${role}`),
    zone: 'park',
    isLandmark: false,
    role,
    ...placing
  }
}

// The park's height rule: under the cap, and low enough to hide no office and no promenade.
export function roomOver(rect: Rect, site: Site, promenades: readonly Rect[]): number {
  const clear = Math.min(...promenades.map((walk) => gapBetween(rect, walk)))
  return Math.min(ZONE_HEIGHT_CAP_M.park, heightLimit(rect, site.offices), clear * HEIGHT_PER_METRE)
}

// Every piece of a group at the height of its lowest, so a row reads as one size.
export function levelled(pieces: readonly GreenPlot[]): GreenPlot[] {
  const lowest = Math.min(...pieces.map((piece) => piece.maxHeight))
  return pieces.map((piece) => ({ ...piece, maxHeight: lowest }))
}

function named<Piece extends ZoneProp | ZoneDesign>(
  pool: readonly Piece[],
  role: GardenRole,
  name: string | undefined
): Piece | undefined {
  const parks = pool.filter((piece) => piece.zones.includes('park'))
  return (
    pool.find((piece) => piece.name === name) ??
    parks.find((piece) => NAME_FITS[role].test(piece.name)) ??
    pool.find((piece) => NAME_FITS[role].test(piece.name)) ??
    (role === 'innerTree' ? undefined : parks.at(0))
  )
}

// A trunk under a round crown, in the theme's park colour.
function gardenTree(dress: TownDress): ZoneDesign {
  return {
    name: GARDEN_TREE,
    zones: ['park'],
    height: { min: 2, max: 5 },
    build: ({ width, depth, height, accent }) => {
      const crown = Math.min(width, depth) * 0.9
      const trunk = height * 0.4
      return [
        cylinder([0, trunk / 2, 0], [0.25, trunk, 0.25], dress.roads.carriageway),
        sphere([0, trunk + (height - trunk) / 2, 0], [crown, height - trunk, crown], accent)
      ]
    }
  }
}

const HEDGE: ZoneDesign = {
  name: 'hedge',
  zones: ['park'],
  height: { min: HEDGE_M, max: HEDGE_M },
  build: ({ width, depth, height, accent }) => [
    box([0, height / 2, 0], [width, height, depth], accent)
  ]
}

function designFor(plot: GreenPlot, dress: TownDress): ZoneDesign | undefined {
  if (plot.role === 'hedge') return HEDGE
  const name = dress.garden?.[plot.role]
  if (name === GARDEN_TREE) return gardenTree(dress)
  const ordinary = dress.designs.filter((design) => !design.isLandmark)
  const design = named(ordinary, plot.role, name)
  return design ?? (plot.role === 'innerTree' ? gardenTree(dress) : undefined)
}

// The named piece on its plot, through the shared lot dresser with a pool of that one piece.
// A prop is scaled by its height rule alone: its row's footprint is only where it stands.
export function placeGardenPiece(plot: GreenPlot, base: number, dress: TownDress): PlacedLot {
  const { role } = plot
  if (role === 'hedge' || isBuilt(role)) {
    const design = designFor(plot, dress)
    return dressLot(plot, base, { ...dress, designs: design ? [design] : [], props: [] })
  }
  const prop = named(dress.props, role, dress.garden?.[role])
  const reach = Math.max(plot.width, plot.depth, ...(prop?.size ?? []))
  return dressLot({ ...plot, width: reach, depth: reach }, base, {
    ...dress,
    designs: [],
    props: prop ? [prop] : []
  })
}
