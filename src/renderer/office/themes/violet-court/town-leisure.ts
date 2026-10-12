import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { box, cone, cylinder, lit, SIDES, sphere, type PartSpec } from '../parts'
import { COURT } from './palette'

const CORNERS = SIDES.flatMap((x) => SIDES.map((z) => ({ x, z })))
const PORTICO = [-0.26, -0.09, 0.09, 0.26]

// The opera hall: a lit hall behind a portico, a drum over it and a dome in the zone's colour.
function operaHall({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const hall = height * 0.42
  const cornice = 0.42 + hall
  const drum = height * 0.2
  const domeFoot = cornice + drum
  const finialFoot = domeFoot + height * 0.13
  return [
    box([0, 0.15, 0], [width, 0.3, depth], COURT.slate),
    box([0, 0.3 + hall / 2, -depth * 0.04], [width * 0.86, hall, depth * 0.7], COURT.slate),
    lit(box([0, 0.3 + hall * 0.7, -depth * 0.04], [width * 0.88, 0.16, depth * 0.72], COURT.lumen)),
    box([0, 0.36 + hall, -depth * 0.04], [width * 0.9, 0.12, depth * 0.74], COURT.gold),
    ...PORTICO.map((spot) =>
      cylinder(
        [spot * width, 0.3 + hall * 0.35, depth * 0.4],
        [0.34, hall * 0.7, 0.34],
        COURT.marble
      )
    ),
    box([0, 0.3 + hall * 0.76, depth * 0.38], [width * 0.66, hall * 0.12, depth * 0.16], accent),
    box(
      [0, 0.3 + hall * 0.3, depth * 0.31 + 0.02],
      [width * 0.12, hall * 0.6, 0.04],
      COURT.crimson
    ),
    cylinder([0, cornice + drum / 2, -depth * 0.04], [span * 0.6, drum, span * 0.6], COURT.marble),
    lit(
      cylinder(
        [0, cornice + drum * 0.5, -depth * 0.04],
        [span * 0.62, drum * 0.3, span * 0.62],
        COURT.lumen
      )
    ),
    sphere([0, domeFoot, -depth * 0.04], [span * 0.62, height * 0.3, span * 0.62], accent),
    cone(
      [0, (finialFoot + height) / 2, -depth * 0.04],
      [0.4, height - finialFoot, 0.4],
      COURT.gold
    ),
    ...SIDES.flatMap((side) => {
      const x = side * (width / 2 - 0.5)
      const z = -(depth / 2 - 0.5)
      return [
        cylinder([x, height * 0.3, z], [0.8, height * 0.6, 0.8], COURT.marble),
        cone([x, height * 0.65, z], [0.9, height * 0.1, 0.9], accent)
      ]
    })
  ]
}

const BARRIER_POSTS = [-0.3, 0, 0.3]

// A tilt yard: a sanded list with its barrier, a striped tent behind and a stand on each side.
function tiltYard({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const tent = Math.min(width * 0.36, depth * 0.3)
  const tentWall = height * 0.5
  const tentRoof = height * 0.5 - 0.3
  return [
    box([0, 0.05, 0], [width, 0.1, depth], COURT.slate),
    box([0, 0.12, depth * 0.18], [width * 0.9, 0.04, depth * 0.5], COURT.ivory),
    box([0, 0.5, depth * 0.18], [width * 0.7, 0.08, 0.1], COURT.gold),
    ...BARRIER_POSTS.map((spot) =>
      box([spot * width, 0.3, depth * 0.18], [0.08, 0.4, 0.08], COURT.ink)
    ),
    cylinder([0, 0.1 + tentWall / 2, -depth * 0.3], [tent, tentWall, tent], COURT.ivory),
    cylinder(
      [0, 0.1 + tentWall * 0.5, -depth * 0.3],
      [tent * 1.02, tentWall * 0.2, tent * 1.02],
      accent
    ),
    cone(
      [0, 0.1 + tentWall + tentRoof / 2, -depth * 0.3],
      [tent * 1.12, tentRoof, tent * 1.12],
      accent
    ),
    box([0, height - 0.1, -depth * 0.3], [0.06, 0.2, 0.06], COURT.gold),
    ...SIDES.flatMap((side) => [
      box(
        [side * width * 0.38, 0.1 + height * 0.1, -depth * 0.3],
        [width * 0.16, height * 0.2, depth * 0.3],
        COURT.slate
      ),
      box(
        [side * width * 0.4, 0.1 + height * 0.2, -depth * 0.42],
        [0.1, height * 0.4, 0.1],
        COURT.ink
      ),
      box(
        [side * width * 0.38, 0.14 + height * 0.4, -depth * 0.3],
        [width * 0.2, 0.08, depth * 0.34],
        accent
      ),
      box(
        [side * width * 0.42, 0.1 + height * 0.3, depth * 0.18],
        [0.07, height * 0.6, 0.07],
        COURT.ink
      ),
      box(
        [side * width * 0.42, 0.1 + height * 0.5, depth * 0.18 + 0.2],
        [0.04, height * 0.16, 0.4],
        COURT.crimson
      )
    ])
  ]
}

// A garden house for masked balls: a lit round room under a dome, clipped shrubs at the corners.
function gardenHouse({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const room = height * 0.5
  const eaves = 0.28 + room
  const finialFoot = eaves + height * 0.2
  return [
    box([0, 0.06, 0], [width, 0.12, depth], COURT.slate),
    cylinder([0, 0.2, 0], [span * 0.7, 0.16, span * 0.7], COURT.marble),
    cylinder([0, 0.28 + room / 2, 0], [span * 0.5, room, span * 0.5], COURT.ivory),
    lit(cylinder([0, 0.28 + room * 0.55, 0], [span * 0.52, room * 0.44, span * 0.52], COURT.lumen)),
    ...CORNERS.map(({ x, z }) =>
      cylinder([x * span * 0.2, 0.28 + room / 2, z * span * 0.2], [0.24, room, 0.24], COURT.marble)
    ),
    cylinder([0, eaves + 0.05, 0], [span * 0.6, 0.1, span * 0.6], COURT.gold),
    sphere([0, eaves + 0.1, 0], [span * 0.56, height * 0.5, span * 0.56], accent),
    cone([0, (finialFoot + height) / 2, 0], [0.3, height - finialFoot, 0.3], COURT.gold),
    ...CORNERS.map(({ x, z }) =>
      sphere([x * (width / 2 - 0.6), 0.45, z * (depth / 2 - 0.6)], [0.8, 0.7, 0.8], COURT.violet)
    ),
    ...SIDES.flatMap((side) => [
      box([side * span * 0.16, 0.5, depth / 2 - 0.4], [0.08, 0.8, 0.08], COURT.ink),
      lit(box([side * span * 0.16, 0.98, depth / 2 - 0.4], [0.2, 0.2, 0.2], COURT.lumen))
    ])
  ]
}

const ARCADE_FRONT = [-0.4, -0.2, 0, 0.2, 0.4]
const ARCADE_SIDE = [-0.2, 0, 0.2]

// A cloister: a covered walk on four sides of a violet lawn, a fountain in the middle.
function cloisterLawn({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const span = Math.min(width, depth)
  const column = height - 0.5
  const columnAt = (x: number, z: number): PartSpec =>
    cylinder([x, 0.12 + column / 2, z], [0.24, column, 0.24], COURT.marble)
  return [
    box([0, 0.06, 0], [width, 0.12, depth], COURT.slate),
    box([0, 0.15, 0], [width * 0.62, 0.06, depth * 0.62], COURT.violet),
    ...SIDES.flatMap((side) => [
      ...ARCADE_FRONT.map((spot) => columnAt(spot * width, side * depth * 0.4)),
      ...ARCADE_SIDE.map((spot) => columnAt(side * width * 0.4, spot * depth)),
      box([0, height - 0.3, side * depth * 0.4], [width * 0.92, 0.16, depth * 0.14], accent),
      box([side * width * 0.4, height - 0.3, 0], [width * 0.14, 0.16, depth * 0.66], accent),
      box([0, height - 0.19, side * depth * 0.4], [width * 0.92, 0.06, depth * 0.05], COURT.gold)
    ]),
    cylinder([0, 0.3, 0], [span * 0.3, 0.26, span * 0.3], COURT.marble),
    lit(cylinder([0, 0.44, 0], [span * 0.24, 0.04, span * 0.24], COURT.lumen)),
    cylinder([0, 0.4 + height * 0.2, 0], [0.2, height * 0.4, 0.2], COURT.marble),
    sphere([0, 0.5 + height * 0.4, 0], [0.34, 0.34, 0.34], COURT.gold)
  ]
}

export const COURT_LEISURE_DESIGNS: readonly ZoneDesign[] = [
  {
    name: 'opera-hall',
    zones: ['entertainment'],
    height: { min: 6, max: 20 },
    build: operaHall,
    isLandmark: true
  },
  { name: 'tilt-yard', zones: ['entertainment'], height: { min: 2.4, max: 5 }, build: tiltYard },
  {
    name: 'garden-house',
    zones: ['entertainment'],
    height: { min: 3, max: 6.5 },
    build: gardenHouse
  },
  { name: 'cloister-lawn', zones: ['park'], height: { min: 1.6, max: 3.4 }, build: cloisterLawn }
]
