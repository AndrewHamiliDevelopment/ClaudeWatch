import type { Point } from '../../../office/sim/path'
import { boundsOfZone } from '../logic/zone-framing'
import { rectOf, type Rect } from '../themes/lot-math'
import type { Site } from '../themes/surroundings'
import {
  ROW_ACROSS_M,
  ROW_DEPTH_M,
  gardenPiece,
  levelled,
  roomOver,
  type GreenPlot
} from './garden-pieces'
import type { GardenRole } from './town-dress'
import { MIN_BELT_M, ROAD_WIDTH_M, SIDEWALK_M } from './town-grid'

// Each long edge, outward from the avenue's mouth: a pair flanking it, then lamp, seat, lamp.
const EDGE_SLOTS: readonly (readonly [GardenRole, number])[] = [
  ['plazaPair', 6.8],
  ['lamp', 8.3],
  ['seat', 9.8],
  ['lamp', 11.3]
]
const PIECE_ALONG_M = 1.2
// On the boulevard's inner sidewalk, the promenade, a step short of the pieces' fronts.
const STAND_DEPTH_M = ROAD_WIDTH_M.boulevard - 0.4
const STAND_ROLES: readonly GardenRole[] = ['plazaPair', 'seat']

// The square in front of the gate: across the boulevard and the belt, twice the avenue deep.
export function plazaSquare(claim: Rect): Rect {
  const west = boundsOfZone(claim).minX
  return rectOf(west, west + MIN_BELT_M, -ROAD_WIDTH_M.avenue, ROAD_WIDTH_M.avenue)
}

// Its west edge on the boulevard's outer sidewalk, its east edge on the belt; both face in.
export function plazaPieces(claim: Rect, site: Site, promenades: readonly Rect[]): GreenPlot[] {
  const west = boundsOfZone(claim).minX
  const edges = [
    { name: 'west', x: west + SIDEWALK_M.boulevard / 2, facing: 'east' },
    { name: 'east', x: west + ROW_DEPTH_M, facing: 'west' }
  ] as const
  const pieces = edges.flatMap((edge) =>
    EDGE_SLOTS.flatMap(([role, along]) =>
      [-along, along].map((z) => {
        const rect = { x: edge.x, z, width: ROW_ACROSS_M, depth: PIECE_ALONG_M }
        return gardenPiece(`plaza:${edge.name}:${role}:${z}`, role, rect, {
          facing: edge.facing,
          zoneId: null,
          maxHeight: roomOver(rect, site, promenades)
        })
      })
    )
  )
  return levelled(pieces)
}

// Where citizens bound for the plaza wait: on the promenade by its pairs and seats.
export function plazaStands(claim: Rect): Point[] {
  const x = boundsOfZone(claim).minX + STAND_DEPTH_M
  return EDGE_SLOTS.filter(([role]) => STAND_ROLES.includes(role))
    .flatMap(([, along]) => [-along, along])
    .sort((a, b) => a - b)
    .map((z) => ({ x, z }))
}
