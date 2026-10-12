import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { box, cylinder, lit, SIDES, sphere, turned, type PartSpec } from '../parts'
import { GROVE } from './palette'
import { ON_ITS_SIDE } from './spirit-features'
import { gable } from './town-parts'

// A treehouse: a hut on a deck halfway up a trunk, a ladder to it, the canopy over its roof.
function treehouse({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const deck = height * 0.42
  const hut = height * 0.2
  const rise = height * 0.1
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.pine),
    cylinder([0, 0.2, -span * 0.06], [span * 0.3, 0.4, span * 0.3], GROVE.bark),
    cylinder([0, height * 0.4, -span * 0.06], [span * 0.16, height * 0.8, span * 0.16], GROVE.bark),
    box([0, deck, span * 0.06], [span * 0.56, 0.12, span * 0.5], GROVE.timber),
    box([0, deck + 0.06 + hut / 2, span * 0.08], [span * 0.4, hut, span * 0.34], GROVE.timber),
    ...gable([0, deck + 0.2 + hut + rise, span * 0.08], span * 0.48, span * 0.22, rise, accent),
    lit(
      box(
        [0, deck + 0.06 + hut * 0.55, span * 0.25 + 0.02],
        [span * 0.12, hut * 0.4, 0.04],
        GROVE.lumen
      )
    ),
    box([span * 0.2, deck / 2, span * 0.3], [0.3, deck, 0.06], GROVE.timber),
    sphere([0, height * 0.84, -span * 0.12], [span * 0.8, height * 0.32, span * 0.7], GROVE.moss),
    ...SIDES.map((side) =>
      sphere(
        [side * span * 0.28, height * 0.7, -span * 0.1],
        [span * 0.42, height * 0.26, span * 0.46],
        GROVE.moss
      )
    )
  ]
}

const FLOWERS = [-0.3, -0.1, 0.1, 0.3]

// A thatched cottage: pale walls under a deep thatch, a stone chimney and flowers by the path.
function thatchedCottage({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const wall = height * 0.4
  const rise = height - wall - 0.22
  const front = depth * 0.16 + 0.02
  return [
    box([0, 0.06, 0], [width, 0.12, depth], GROVE.moss),
    box([0, 0.12 + wall / 2, -depth * 0.06], [width * 0.56, wall, depth * 0.44], GROVE.paper),
    box(
      [0, 0.12 + wall + rise * 0.25, -depth * 0.06],
      [width * 0.56, rise * 0.5, depth * 0.2],
      GROVE.paper
    ),
    ...gable([0, height, -depth * 0.06], width * 0.66, depth * 0.3, rise, accent),
    box([width * 0.2, height * 0.75, -depth * 0.06], [0.5, height * 0.5, 0.5], GROVE.stone),
    box([-width * 0.08, 0.12 + wall * 0.4, front], [0.6, wall * 0.8, 0.04], GROVE.bark),
    lit(box([width * 0.14, 0.12 + wall * 0.55, front], [0.5, wall * 0.36, 0.04], GROVE.lumen)),
    sphere([-width * 0.08, 0.14, depth * 0.26], [0.6, 0.1, 0.5], GROVE.stone),
    ...FLOWERS.map((spot, index) =>
      sphere(
        [spot * width, 0.26, depth * 0.38],
        [0.6, 0.4, 0.5],
        index % 2 ? GROVE.clay : GROVE.fern
      )
    )
  ]
}

const SHED_POSTS = [-0.36, 0, 0.36]

// A sawmill: an open shed over the saw bench, a log on it, and logs and planks stacked in front.
function sawmill({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const post = height * 0.55
  const shed = -depth * 0.12
  const yard = depth * 0.26
  return [
    box([0, 0.06, 0], [width, 0.12, depth], GROVE.bark),
    ...SIDES.flatMap((side) =>
      SHED_POSTS.map((spot) =>
        cylinder(
          [spot * width, post / 2, shed + side * depth * 0.22],
          [0.2, post, 0.2],
          GROVE.timber
        )
      )
    ),
    ...gable([0, height, shed], width * 0.84, depth * 0.26, height - post - 0.1, accent),
    box([0, 0.5, shed], [width * 0.5, 0.16, 0.7], GROVE.timber),
    turned(cylinder([-width * 0.08, 0.83, shed], [0.5, width * 0.4, 0.5], GROVE.bark), ON_ITS_SIDE),
    turned(cylinder([width * 0.2, 0.9, shed], [1, 0.06, 1], GROVE.stone), ON_ITS_SIDE),
    ...[
      [0.37, yard],
      [0.37, yard + 0.5],
      [0.8, yard + 0.25]
    ].map(([y, z]) =>
      turned(cylinder([-width * 0.2, y, z], [0.5, width * 0.36, 0.5], GROVE.bark), ON_ITS_SIDE)
    ),
    box([width * 0.28, 0.37, depth * 0.32], [width * 0.26, 0.5, 0.8], GROVE.timber),
    box([width * 0.28, 0.65, depth * 0.32], [width * 0.26, 0.06, 0.8], GROVE.paper)
  ]
}

// A forge shed: stone walls round a glowing hearth, a chimney with embers at its top, and an
// anvil, a trough and a heap of charcoal in the yard.
function forgeShed({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const wall = height * 0.42
  const ridge = height * 0.86
  const shed = { x: -width * 0.1, z: -depth * 0.1 }
  const front = depth * 0.13
  return [
    box([0, 0.06, 0], [width, 0.12, depth], GROVE.bark),
    box([shed.x, 0.12 + wall / 2, shed.z], [width * 0.56, wall, depth * 0.46], GROVE.stone),
    ...gable([shed.x, ridge, shed.z], width * 0.62, depth * 0.28, ridge - wall - 0.22, accent),
    box([shed.x, 0.12 + wall * 0.4, front + 0.02], [width * 0.3, wall * 0.8, 0.04], GROVE.soil),
    lit(
      box([shed.x, 0.12 + wall * 0.25, front + 0.05], [width * 0.14, wall * 0.3, 0.04], GROVE.lumen)
    ),
    box(
      [width * 0.3, (height - 0.2) / 2, shed.z],
      [width * 0.14, height - 0.2, width * 0.14],
      GROVE.stone
    ),
    lit(box([width * 0.3, height - 0.1, shed.z], [width * 0.1, 0.2, width * 0.1], GROVE.lumen)),
    box([-width * 0.3, 0.27, depth * 0.32], [0.5, 0.3, 0.3], GROVE.soil),
    box([-width * 0.3, 0.49, depth * 0.32], [0.7, 0.14, 0.34], GROVE.soil),
    box([width * 0.04, 0.27, depth * 0.34], [width * 0.2, 0.3, 0.44], GROVE.timber),
    box([width * 0.04, 0.43, depth * 0.34], [width * 0.17, 0.02, 0.32], GROVE.pond),
    sphere([width * 0.34, 0.3, depth * 0.3], [0.9, 0.5, 0.8], GROVE.soil)
  ]
}

export const GROVE_QUARTER_DESIGNS: readonly ZoneDesign[] = [
  { name: 'treehouse', zones: ['residential'], height: { min: 4, max: 9 }, build: treehouse },
  {
    name: 'thatched-cottage',
    zones: ['residential'],
    height: { min: 2.2, max: 4 },
    build: thatchedCottage
  },
  { name: 'sawmill', zones: ['workshop'], height: { min: 2.6, max: 6 }, build: sawmill },
  { name: 'forge-shed', zones: ['workshop'], height: { min: 2.4, max: 5 }, build: forgeShed }
]
