import { box, lit, SIDES, turned, type PartSpec, cone, cylinder, sphere } from '../parts'
import type { BuildingDesign, Plot } from '../lot-kit'
import { GROVE } from './palette'
import { ON_ITS_SIDE } from './spirit-features'

const CORNERS = SIDES.flatMap((x) => SIDES.map((z) => ({ x, z })))
const ROOF_PITCH = 0.5
const ROOF_THICKNESS = 0.14

// Two slabs meeting at a ridge that tops out at `top`, each `run` metres from eave to ridge.
function pitchedRoof(top: number, length: number, run: number, color: string): PartSpec[] {
  const rise = (ROOF_THICKNESS / 2) * Math.cos(ROOF_PITCH) + (run / 2) * Math.sin(ROOF_PITCH)
  return SIDES.map((side) =>
    turned(
      box(
        [0, top - rise, side * (run / 2) * Math.cos(ROOF_PITCH)],
        [length, ROOF_THICKNESS, run],
        color
      ),
      [side * ROOF_PITCH, 0, 0]
    )
  )
}

// A trunk under three stacked cones, `tall` metres to its tip.
function pine(x: number, z: number, tall: number, spread: number): PartSpec[] {
  return [
    cylinder([x, tall * 0.15, z], [tall * 0.07, tall * 0.3, tall * 0.07], GROVE.bark),
    ...[0, 1, 2].map((tier) => {
      const width = spread * (1 - tier * 0.25)
      return cone([x, tall * (0.37 + tier * 0.21), z], [width, tall * 0.34, width], GROVE.pine)
    })
  ]
}

// A still pond in a dark bank: stepping stones across, reeds in one corner, a floating light.
function pond({ width, depth, height }: Plot): PartSpec[] {
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.bark),
    box([0, 0.09, 0], [width * 0.8, 0.04, depth * 0.7], GROVE.pond),
    ...[-0.3, -0.1, 0.1, 0.3].map((step) =>
      sphere([step * width, 0.12, step * depth * 0.6], [0.7, 0.14, 0.6], GROVE.stone)
    ),
    ...[0, 1, 2].map((reed) =>
      cylinder(
        [width * 0.36 - reed * 0.16, height / 2, -depth * 0.3],
        [0.05, height, 0.05],
        GROVE.bark
      )
    ),
    sphere([-width * 0.38, 0.2, depth * 0.38], [1, 0.5, 0.9], GROVE.moss),
    sphere([width * 0.4, 0.18, depth * 0.36], [0.8, 0.4, 0.8], GROVE.moss),
    lit(sphere([-width * 0.16, 0.26, depth * 0.14], [0.3, 0.3, 0.3], GROVE.lumen))
  ]
}

// A rock garden: one standing stone among smaller ones, moss mounds, a lantern and a sapling.
function rockGarden({ width, depth, height }: Plot): PartSpec[] {
  return [
    box([0, 0.05, 0], [width, 0.1, depth], GROVE.bark),
    sphere([width * 0.12, height * 0.45, -depth * 0.1], [1.6, height * 0.9, 1.3], GROVE.stone),
    sphere([-width * 0.28, 0.3, -depth * 0.26], [1.1, 0.6, 0.9], GROVE.stone),
    sphere([width * 0.3, 0.2, depth * 0.28], [0.8, 0.4, 0.7], GROVE.stone),
    sphere([-width * 0.1, 0.14, depth * 0.3], [0.5, 0.28, 0.5], GROVE.stone),
    sphere([-width * 0.3, 0.16, depth * 0.12], [1.4, 0.36, 1.2], GROVE.moss),
    sphere([width * 0.32, 0.14, -depth * 0.3], [1.1, 0.3, 1], GROVE.moss),
    cylinder([-width * 0.36, height * 0.3, depth * 0.38], [0.08, height * 0.6, 0.08], GROVE.bark),
    lit(sphere([-width * 0.36, height * 0.72, depth * 0.38], [0.3, 0.3, 0.3], GROVE.lumen)),
    ...pine(width * 0.36, -depth * 0.02, height, 0.6)
  ]
}

// A cabin: timber walls on a dark deck, a pitched roof, a chimney and a lantern by the door.
function cabin({ width, depth, height }: Plot): PartSpec[] {
  const wall = height * 0.5
  const front = depth * 0.3 + 0.03
  return [
    box([0, 0.1, 0], [width, 0.2, depth], GROVE.bark),
    box([0, 0.2 + wall / 2, 0], [width * 0.7, wall, depth * 0.6], GROVE.timber),
    ...pitchedRoof(height - 0.02, width * 0.8, depth * 0.42, GROVE.bark),
    cylinder([-width * 0.25, height / 2, -depth * 0.1], [0.4, height, 0.4], GROVE.bark),
    box([0, 0.65, front], [0.6, 0.9, 0.05], GROVE.bark),
    box([width * 0.2, 0.2 + wall * 0.6, front], [0.5, 0.4, 0.05], GROVE.pond),
    lit(sphere([-0.6, 1.3, front + 0.12], [0.22, 0.26, 0.22], GROVE.lumen)),
    ...SIDES.map((side) =>
      sphere([side * width * 0.4, 0.4, depth * 0.4], [0.8, 0.6, 0.7], GROVE.moss)
    )
  ]
}

// A greenhouse: a timber frame under a glass roof, over two planter beds.
function greenhouse({ width, depth, height }: Plot): PartSpec[] {
  const post = height * 0.62
  return [
    box([0, 0.06, 0], [width, 0.12, depth], GROVE.bark),
    ...SIDES.flatMap((side) => [
      ...[-0.4, 0, 0.4].map((spot) =>
        box([spot * width, post / 2, side * depth * 0.36], [0.14, post, 0.14], GROVE.timber)
      ),
      box([0, post, side * depth * 0.36], [width * 0.9, 0.14, 0.18], GROVE.timber),
      box([0, 0.3, side * depth * 0.16], [width * 0.7, 0.36, 0.7], GROVE.timber),
      ...[-0.25, 0, 0.25].map((spot) =>
        sphere([spot * width, 0.62, side * depth * 0.16], [0.6, 0.5, 0.6], GROVE.moss)
      )
    ]),
    ...pitchedRoof(height - 0.02, width * 0.86, depth * 0.44, GROVE.pond)
  ]
}

// A mill: a timber tower with a water wheel on one side, turning in a race of pond water.
function mill({ width, depth, height }: Plot): PartSpec[] {
  const body = height * 0.62
  const radius = Math.min(height * 0.3, depth * 0.3)
  const wheelX = width * 0.32
  const axle = radius + 0.25
  return [
    box([0, 0.1, 0], [width, 0.2, depth], GROVE.bark),
    box([-width * 0.08, 0.2 + body / 2, 0], [width * 0.46, body, depth * 0.5], GROVE.timber),
    ...pitchedRoof(height - 0.02, width * 0.56, depth * 0.36, GROVE.bark).map(
      (slab): PartSpec => ({ ...slab, at: [-width * 0.08, slab.at[1], slab.at[2]] })
    ),
    box([wheelX, 0.24, 0], [0.7, 0.08, depth * 0.9], GROVE.pond),
    turned(cylinder([wheelX, axle, 0], [radius * 2, 0.3, radius * 2], GROVE.bark), ON_ITS_SIDE),
    box([wheelX + 0.18, axle, 0], [0.06, radius * 2.1, 0.2], GROVE.timber),
    box([wheelX + 0.18, axle, 0], [0.06, 0.2, radius * 2.1], GROVE.timber),
    box([-width * 0.08, 0.7, depth * 0.25 + 0.03], [0.6, 1, 0.05], GROVE.bark),
    box([-width * 0.08, 0.2 + body * 0.75, depth * 0.25 + 0.03], [0.5, 0.4, 0.05], GROVE.pond),
    sphere([-width * 0.4, 0.4, depth * 0.38], [0.8, 0.6, 0.8], GROVE.moss)
  ]
}

// A watchtower on four stilts: a timber hut on a platform, under a wide flat roof.
function watchtower({ width, depth, height }: Plot): PartSpec[] {
  const span = Math.min(width, depth)
  const deck = height * 0.6
  const hut = height * 0.3
  return [
    ...CORNERS.map(({ x, z }) =>
      cylinder([x * span * 0.22, deck / 2, z * span * 0.22], [0.2, deck, 0.2], GROVE.bark)
    ),
    box([0, deck, 0], [span * 0.62, 0.14, span * 0.62], GROVE.timber),
    box([0, deck + 0.07 + hut / 2, 0], [span * 0.42, hut, span * 0.42], GROVE.timber),
    box([0, deck + hut * 0.6, span * 0.21 + 0.02], [span * 0.2, hut * 0.4, 0.04], GROVE.pond),
    box([0, height - 0.08, 0], [span * 0.7, 0.16, span * 0.7], GROVE.bark),
    lit(sphere([span * 0.28, deck + 0.4, span * 0.28], [0.28, 0.32, 0.28], GROVE.lumen)),
    sphere([span * 0.34, 0.3, -span * 0.3], [1, 0.6, 1], GROVE.moss),
    sphere([-span * 0.36, 0.2, span * 0.34], [0.7, 0.4, 0.6], GROVE.stone)
  ]
}

const STAND: readonly { x: number; z: number; share: number }[] = [
  { x: 0, z: 0, share: 1 },
  { x: -0.27, z: -0.25, share: 0.78 },
  { x: 0.27, z: -0.22, share: 0.64 },
  { x: -0.24, z: 0.27, share: 0.7 },
  { x: 0.26, z: 0.26, share: 0.88 }
]

// A stand of pines of five heights around a mossy rock.
function pineStand({ width, depth, height }: Plot): PartSpec[] {
  const span = Math.min(width, depth)
  return [
    ...STAND.flatMap((tree) => {
      const tall = height * tree.share
      return pine(tree.x * width, tree.z * depth, tall, Math.min(tall * 0.42, span * 0.44))
    }),
    sphere([0, 0.2, depth * 0.3], [1.2, 0.5, 0.9], GROVE.stone),
    sphere([width * 0.05, 0.3, -depth * 0.36], [1.4, 0.6, 1], GROVE.moss)
  ]
}

// A great tree: a trunk as wide as a room, a canopy in five lobes, lanterns and a tree house.
function greatTree({ width, depth, height }: Plot): PartSpec[] {
  const span = Math.min(width, depth)
  return [
    cylinder([0, 0.3, 0], [span * 0.36, 0.6, span * 0.36], GROVE.bark),
    cylinder([0, height * 0.3, 0], [span * 0.22, height * 0.6, span * 0.22], GROVE.bark),
    sphere([0, height * 0.74, 0], [span * 0.96, height * 0.5, span * 0.96], GROVE.moss),
    ...CORNERS.map(({ x, z }) =>
      sphere(
        [x * span * 0.2, height * 0.58, z * span * 0.2],
        [span * 0.55, height * 0.3, span * 0.55],
        GROVE.moss
      )
    ),
    ...SIDES.flatMap((side) => [
      lit(sphere([side * span * 0.32, height * 0.4, 0], [0.4, 0.46, 0.4], GROVE.lumen)),
      lit(sphere([0, height * 0.36, side * span * 0.32], [0.4, 0.46, 0.4], GROVE.lumen))
    ]),
    box([span * 0.2, height * 0.26, 0], [span * 0.3, 0.12, span * 0.3], GROVE.timber),
    box([span * 0.2, height * 0.26 + 0.5, 0], [span * 0.22, 0.9, span * 0.22], GROVE.timber),
    box([span * 0.2, height * 0.26 + 1, 0], [span * 0.3, 0.12, span * 0.3], GROVE.bark)
  ]
}

export const GROVE_BUILDINGS: readonly BuildingDesign[] = [
  { name: 'pond', height: { min: 0.8, max: 1 }, build: pond },
  { name: 'rock-garden', height: { min: 0.9, max: 1.3 }, build: rockGarden },
  { name: 'cabin', height: { min: 2.2, max: 3.2 }, build: cabin },
  { name: 'greenhouse', height: { min: 2.2, max: 3.4 }, build: greenhouse },
  { name: 'mill', height: { min: 3, max: 6 }, build: mill },
  { name: 'watchtower', height: { min: 4, max: 10 }, build: watchtower },
  { name: 'pine-stand', height: { min: 3, max: 12 }, build: pineStand },
  { name: 'great-tree', height: { min: 7, max: 24 }, build: greatTree }
]
