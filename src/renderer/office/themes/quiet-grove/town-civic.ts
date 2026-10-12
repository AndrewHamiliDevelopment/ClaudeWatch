import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { box, cylinder, lit, SIDES, sphere, turned, type PartSpec } from '../parts'
import { GROVE } from './palette'
import { CORNERS, cornerMoss, gable, ring } from './town-parts'

// The meeting hall: a long timber hall with its doors to the street, under a great tree.
function meetingHall({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const wall = height * 0.34
  const rise = height * 0.18
  const front = depth * 0.36 + 0.02
  return [
    box([0, 0.08, 0], [width, 0.16, depth], GROVE.bark),
    box([0, 0.16 + wall / 2, depth * 0.14], [width * 0.7, wall, depth * 0.44], GROVE.timber),
    ...gable([0, 0.3 + wall + rise, depth * 0.14], width * 0.78, depth * 0.26, rise, accent),
    box([0, 0.16 + wall * 0.4, front], [0.7, wall * 0.8, 0.04], GROVE.bark),
    ...SIDES.map((side) =>
      lit(sphere([side * 0.7, 0.16 + wall * 0.7, front + 0.1], [0.22, 0.26, 0.22], GROVE.lumen))
    ),
    cylinder(
      [0, height * 0.3, -depth * 0.28],
      [span * 0.16, height * 0.6, span * 0.16],
      GROVE.bark
    ),
    sphere([0, height * 0.76, -depth * 0.14], [span * 0.9, height * 0.48, span * 0.7], GROVE.moss),
    ...SIDES.map((side) =>
      sphere(
        [side * width * 0.24, height * 0.62, -depth * 0.2],
        [span * 0.5, height * 0.3, span * 0.5],
        GROVE.moss
      )
    )
  ]
}

const STONE_SHARES = [1, 0.8, 0.92, 0.72, 0.88, 0.78]

// Standing stones: a ring of tall ones round a flat stone with a lantern on it.
function standingStones({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.pine),
    cylinder([0, 0.1, 0], [span * 0.94, 0.06, span * 0.94], GROVE.moss),
    ...ring(STONE_SHARES.length, span * 0.34).map(({ x, z }, index) => {
      const tall = height * STONE_SHARES[index]
      return sphere([x, tall / 2, z], [span * 0.14, tall, span * 0.1], accent)
    }),
    cylinder([0, 0.25, 0], [span * 0.24, 0.3, span * 0.24], GROVE.stone),
    lit(sphere([0, 0.55, 0], [0.3, 0.3, 0.3], GROVE.lumen)),
    ...cornerMoss(width, depth)
  ]
}

const PRODUCE = [GROVE.clay, GROVE.fern, GROVE.paper]

// A market glade: four stalls on the grass, each a counter of produce under a pitched awning.
function marketGlade({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  // An awning's far edge hangs this much under its near one.
  const drop = depth * 0.03
  const post = height - 0.4 - drop
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.moss),
    box([0, 0.6, 0], [0.12, 1.04, 0.12], GROVE.bark),
    lit(sphere([0, 1.24, 0], [0.3, 0.32, 0.3], GROVE.lumen)),
    ...CORNERS.flatMap(({ x, z }) => {
      const stall = { x: x * width * 0.24, z: z * depth * 0.22 }
      return [
        box([stall.x, 0.4, stall.z], [width * 0.3, 0.5, depth * 0.2], GROVE.timber),
        ...PRODUCE.map((color, index) =>
          sphere([stall.x + (index - 1) * width * 0.09, 0.74, stall.z], [0.3, 0.26, 0.3], color)
        ),
        ...SIDES.map((side) =>
          box([stall.x + side * width * 0.15, post / 2, stall.z], [0.1, post, 0.1], GROVE.bark)
        ),
        turned(
          box([stall.x, height - 0.05 - drop, stall.z], [width * 0.36, 0.08, depth * 0.3], accent),
          [z * 0.2, 0, 0]
        )
      ]
    })
  ]
}

const SKEPS = [-0.25, 0, 0.25]
const JARS = [-0.1, 0, 0.1]

// A honey shed: a small timber shed with jars on its shelf and a row of straw hives beside it.
function honeyShed({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const wall = height * 0.5
  const front = depth * 0.11
  const shed = { x: -width * 0.16, z: -depth * 0.12 }
  return [
    box([0, 0.08, 0], [width, 0.16, depth], GROVE.bark),
    box([shed.x, 0.16 + wall / 2, shed.z], [width * 0.5, wall, depth * 0.46], GROVE.timber),
    ...gable([shed.x, height, shed.z], width * 0.56, depth * 0.27, height - wall - 0.26, accent),
    box([-width * 0.3, 0.16 + wall * 0.4, front + 0.02], [0.6, wall * 0.8, 0.04], GROVE.bark),
    box([-width * 0.08, 0.16 + wall * 0.45, front + 0.12], [width * 0.26, 0.08, 0.24], GROVE.bark),
    ...JARS.map((spot) =>
      lit(
        sphere(
          [(spot - 0.08) * width, 0.33 + wall * 0.45, front + 0.12],
          [0.22, 0.26, 0.22],
          GROVE.lumen
        )
      )
    ),
    ...SKEPS.flatMap((spot) => [
      box([width * 0.3, 0.22, spot * depth], [0.8, 0.12, 0.8], GROVE.bark),
      sphere([width * 0.3, 0.6, spot * depth], [0.7, 0.7, 0.7], GROVE.timber),
      sphere([width * 0.3, 0.9, spot * depth], [0.4, 0.3, 0.4], GROVE.timber)
    ]),
    ...SIDES.map((side) =>
      sphere([shed.x + side * width * 0.14, 0.34, depth * 0.38], [0.8, 0.4, 0.5], GROVE.fern)
    )
  ]
}

export const GROVE_CIVIC_DESIGNS: readonly ZoneDesign[] = [
  { name: 'meeting-hall', zones: ['civic'], height: { min: 3, max: 8 }, build: meetingHall },
  {
    name: 'standing-stones',
    zones: ['civic'],
    height: { min: 2, max: 4.5 },
    build: standingStones
  },
  { name: 'market-glade', zones: ['market'], height: { min: 2, max: 3.4 }, build: marketGlade },
  { name: 'honey-shed', zones: ['market'], height: { min: 2.2, max: 3.6 }, build: honeyShed }
]
