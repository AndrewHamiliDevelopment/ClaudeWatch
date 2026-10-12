import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { box, cone, cylinder, lit, SIDES, sphere, turned, type PartSpec } from '../parts'
import { GROVE } from './palette'
import { ON_ITS_SIDE } from './spirit-features'
import { cornerMoss, gable, ring } from './town-parts'

const PENNANTS = [0.78, 0.62, 0.46]

// The festival green: a bonfire in a ring of stones, a roofed stage behind it and a tall
// festival pole hung with pennants, seen from across the town.
function festivalGreen({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const post = Math.min(height * 0.3, 3)
  const rise = Math.min(height * 0.14, 1.4)
  const fire = Math.min(height * 0.3, 2.4)
  const hearth = depth * 0.14
  const pole = { x: width * 0.34, z: depth * 0.3 }
  return [
    box([0, 0.05, 0], [width, 0.1, depth], GROVE.moss),
    box([0, 0.4, -depth * 0.3], [width * 0.6, 0.6, depth * 0.3], GROVE.timber),
    ...SIDES.flatMap((side) =>
      SIDES.map((end) =>
        cylinder(
          [side * width * 0.27, 0.7 + post / 2, depth * (end * 0.12 - 0.3)],
          [0.16, post, 0.16],
          GROVE.bark
        )
      )
    ),
    ...gable([0, 0.84 + post + rise, -depth * 0.3], width * 0.66, depth * 0.17, rise, accent),
    ...ring(6, span * 0.16).map(({ x, z }) =>
      sphere([x, 0.2, hearth + z], [0.5, 0.3, 0.5], GROVE.stone)
    ),
    cone([0, 0.1 + fire * 0.25, hearth], [span * 0.24, fire * 0.5, span * 0.24], GROVE.bark),
    lit(cone([0, 0.1 + fire * 0.5, hearth], [span * 0.18, fire, span * 0.18], GROVE.clay)),
    lit(cone([0, 0.1 + fire * 0.4, hearth], [span * 0.1, fire * 0.8, span * 0.1], GROVE.lumen)),
    cylinder([pole.x, (height - 0.4) / 2, pole.z], [0.2, height - 0.4, 0.2], GROVE.bark),
    lit(sphere([pole.x, height - 0.25, pole.z], [0.5, 0.5, 0.5], GROVE.lumen)),
    ...PENNANTS.map((share) =>
      box([pole.x - 0.35, height * share, pole.z], [0.5, height * 0.06, 0.04], accent)
    ),
    ...SIDES.map((side) =>
      turned(
        cylinder([side * width * 0.24, 0.25, depth * 0.38], [0.3, width * 0.2, 0.3], GROVE.bark),
        ON_ITS_SIDE
      )
    )
  ]
}

// A spring pavilion: a round pool with a rim of stone, under a pointed roof on six posts.
function springPavilion({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const post = height * 0.6
  const eaves = 0.32 + post
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.bark),
    cylinder([0, 0.14, 0], [span * 0.8, 0.12, span * 0.8], GROVE.stone),
    cylinder([0, 0.21, 0], [span * 0.68, 0.04, span * 0.68], GROVE.pond),
    sphere([0, 0.3, 0], [span * 0.2, 0.4, span * 0.2], GROVE.stone),
    lit(sphere([span * 0.16, 0.34, span * 0.1], [0.3, 0.3, 0.3], GROVE.lumen)),
    ...ring(6, span * 0.3).map(({ x, z }) =>
      cylinder([x, 0.2 + post / 2, z], [0.18, post, 0.18], GROVE.timber)
    ),
    cylinder([0, 0.26 + post, 0], [span * 0.72, 0.12, span * 0.72], GROVE.timber),
    cone([0, (eaves + height) / 2, 0], [span * 0.84, height - eaves, span * 0.84], accent),
    ...cornerMoss(width, depth)
  ]
}

// Seats one to seven of eight round the fire: the eighth place is the teller's.
const LISTENERS = [1, 2, 3, 5, 6, 7]

// A story circle: log seats round a lantern, the teller's stump under a cloth between two poles.
function storyCircle({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const seats = ring(8, span * 0.3)
  return [
    box([0, 0.04, 0], [width, 0.08, depth], GROVE.moss),
    cylinder([0, 0.16, 0], [0.8, 0.16, 0.8], GROVE.stone),
    lit(sphere([0, 0.46, 0], [0.5, 0.46, 0.5], GROVE.lumen)),
    ...LISTENERS.map((seat) =>
      cylinder([seats[seat].x, 0.26, seats[seat].z], [0.5, 0.36, 0.5], GROVE.bark)
    ),
    cylinder([0, 0.4, -span * 0.3], [0.8, 0.64, 0.8], GROVE.bark),
    box([0, 0.72 + height * 0.14, -span * 0.3 - 0.3], [0.8, height * 0.28, 0.12], GROVE.timber),
    ...SIDES.flatMap((side) => [
      cylinder(
        [side * span * 0.36, (height - 0.1) / 2, -span * 0.38],
        [0.14, height - 0.1, 0.14],
        GROVE.bark
      ),
      lit(
        sphere(
          [side * span * 0.36, height * 0.6, -span * 0.38 + 0.2],
          [0.24, 0.28, 0.24],
          GROVE.lumen
        )
      )
    ]),
    // Tied high at the poles, the cloth falls toward the circle.
    turned(
      box([0, height - 0.05 - span * 0.05, -span * 0.26], [span * 0.78, 0.06, span * 0.3], accent),
      [0.3, 0, 0]
    )
  ]
}

const TUFTS: readonly { x: number; z: number; color: string }[] = [
  { x: -0.34, z: 0.3, color: GROVE.clay },
  { x: -0.1, z: 0.36, color: GROVE.paper },
  { x: 0.22, z: 0.26, color: GROVE.lumen },
  { x: 0.36, z: -0.02, color: GROVE.clay },
  { x: -0.3, z: -0.08, color: GROVE.paper },
  { x: -0.06, z: -0.3, color: GROVE.clay },
  { x: 0.06, z: 0.04, color: GROVE.paper }
]

// A meadow: open grass in the park's own green, wild flowers, a boulder and one young birch.
function meadow({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const birch = { x: width * 0.28, z: -depth * 0.26 }
  return [
    box([0, 0.05, 0], [width, 0.1, depth], accent),
    ...TUFTS.map(({ x, z, color }) => sphere([x * width, 0.2, z * depth], [0.4, 0.26, 0.4], color)),
    sphere([-width * 0.2, 0.24, -depth * 0.3], [0.9, 0.44, 0.7], GROVE.stone),
    cylinder([birch.x, height * 0.35, birch.z], [0.14, height * 0.7, 0.14], GROVE.paper),
    sphere([birch.x, height * 0.76, birch.z], [1.2, height * 0.48, 1.2], accent)
  ]
}

export const GROVE_LEISURE_DESIGNS: readonly ZoneDesign[] = [
  {
    name: 'festival-green',
    zones: ['entertainment'],
    height: { min: 4, max: 12 },
    build: festivalGreen,
    isLandmark: true
  },
  {
    name: 'spring-pavilion',
    zones: ['entertainment'],
    height: { min: 2.4, max: 5 },
    build: springPavilion
  },
  {
    name: 'story-circle',
    zones: ['entertainment'],
    height: { min: 2, max: 3.6 },
    build: storyCircle
  },
  { name: 'meadow', zones: ['park'], height: { min: 1.2, max: 2.4 }, build: meadow }
]
