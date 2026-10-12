import type { Point } from '../../../office/sim/path'
import { clamp } from '../../../shared/range'
import { boundsOfZone, type Bounds } from '../logic/zone-framing'
import { grow, type Rect } from '../themes/lot-math'
import { LOT_PITCH_M, ROAD_WIDTH_M } from './town-grid'
import type { RoadClass, TownRoad } from './town-roads'

interface RoadNode extends Point {
  // Its place in `RoadGraph.nodes`.
  id: number
}
export interface RoadEdge {
  from: number
  to: number
  class: RoadClass
  length: number
}
export interface RoadGraph {
  nodes: RoadNode[]
  edges: RoadEdge[]
}

// Roads are axis-aligned, so along one this is the distance.
export const apart = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.z - b.z)

// Where the avenue meets the boulevard, in front of the gate: as far as a citizen comes.
export function gatePlaza(claim: Rect): Point {
  return { x: claim.x - claim.width / 2 + ROAD_WIDTH_M.boulevard / 2, z: 0 }
}

// A road's end that stops at a side of the claim, corners left out.
function isOnClaimSide(point: Point, claim: Bounds): boolean {
  const isBesideX = point.z > claim.minZ && point.z < claim.maxZ
  const isBesideZ = point.x > claim.minX && point.x < claim.maxX
  return (
    (isBesideX && (point.x === claim.minX || point.x === claim.maxX)) ||
    (isBesideZ && (point.z === claim.minZ || point.z === claim.maxZ))
  )
}

// A node at every crossing of two road lines and at each boulevard corner; an edge per road
// stretch between two nodes. A road that stops at the claim is joined on to the boulevard.
export function roadGraph(roads: readonly TownRoad[], claim: Rect): RoadGraph {
  const nodes: RoadNode[] = []
  const edges: RoadEdge[] = []
  const idAt = new Map<string, number>()
  const nodeAt = ({ x, z }: Point): number => {
    const place = `${x}:${z}`
    const known = idAt.get(place)
    if (known !== undefined) return known
    nodes.push({ id: nodes.length, x, z })
    idAt.set(place, nodes.length - 1)
    return nodes.length - 1
  }
  const join = (from: number, to: number, roadClass: RoadClass): void => {
    edges.push({ from, to, class: roadClass, length: apart(nodes[from], nodes[to]) })
  }

  const edge = boundsOfZone(claim)
  const centre = boundsOfZone(grow(claim, -ROAD_WIDTH_M.boulevard / 2))
  const joinedOn: number[] = []
  for (const road of roads.filter((each) => each.class !== 'boulevard')) {
    const steps = apart(road.from, road.to) / LOT_PITCH_M
    const along = Array.from({ length: steps + 1 }, (_, step) =>
      nodeAt({
        x: road.from.x + ((road.to.x - road.from.x) * step) / steps,
        z: road.from.z + ((road.to.z - road.from.z) * step) / steps
      })
    )
    along.slice(1).forEach((node, index) => join(along[index], node, road.class))
    for (const end of [road.from, road.to].filter((point) => isOnClaimSide(point, edge))) {
      const onBoulevard = nodeAt({
        x: clamp(end.x, [centre.minX, centre.maxX]),
        z: clamp(end.z, [centre.minZ, centre.maxZ])
      })
      join(nodeAt(end), onBoulevard, road.class)
      joinedOn.push(onBoulevard)
    }
  }

  for (const strip of roads.filter((each) => each.class === 'boulevard')) {
    const isAlongX = strip.from.z === strip.to.z
    const onStrip = joinedOn.filter((id) =>
      isAlongX ? nodes[id].z === strip.from.z : nodes[id].x === strip.from.x
    )
    const along = [nodeAt(strip.from), ...onStrip, nodeAt(strip.to)].sort((a, b) =>
      isAlongX ? nodes[a].x - nodes[b].x : nodes[a].z - nodes[b].z
    )
    along.slice(1).forEach((node, index) => join(along[index], node, 'boulevard'))
  }
  return { nodes, edges }
}
