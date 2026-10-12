import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { box, cone, cylinder, lit, SIDES, type PartSpec } from '../parts'
import { COURT } from './palette'

// A gatehouse: two round towers under pointed roofs, a wall between them with a lit passage.
function gatehouse({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const tower = height * 0.76
  const wall = height * 0.5
  const girth = Math.min(width * 0.24, depth * 0.7)
  return [
    box([0, 0.06, 0], [width, 0.12, depth], COURT.slate),
    ...SIDES.map((side) =>
      box([side * width * 0.17, 0.12 + wall / 2, 0], [width * 0.14, wall, depth * 0.4], COURT.slate)
    ),
    box([0, 0.12 + wall * 0.85, 0], [width * 0.2, wall * 0.3, depth * 0.4], COURT.slate),
    box([0, 0.17 + wall, 0], [width * 0.5, 0.1, depth * 0.46], COURT.gold),
    box([0, 0.12 + wall * 0.35, -depth * 0.1], [width * 0.2, wall * 0.7, 0.06], COURT.ink),
    lit(box([0, 0.12 + wall * 0.8, depth * 0.2 + 0.02], [width * 0.12, 0.14, 0.04], COURT.lumen)),
    box([0, 0.12 + wall * 0.5, depth * 0.2 + 0.03], [0.5, wall * 0.3, 0.04], COURT.crimson),
    ...SIDES.flatMap((side) => {
      const x = side * (width / 2 - girth / 2 - 0.1)
      return [
        cylinder([x, tower / 2, 0], [girth, tower, girth], COURT.marble),
        cylinder([x, tower - 0.06, 0], [girth * 1.04, 0.12, girth * 1.04], COURT.gold),
        lit(box([x, tower * 0.7, girth / 2], [0.24, tower * 0.14, 0.04], COURT.lumen)),
        cone([x, (tower + height) / 2, 0], [girth, height - tower, girth], accent)
      ]
    })
  ]
}

const PIERS = [-0.4, -0.2, 0, 0.2, 0.4]
const BOOK_STALLS = [-0.3, -0.1, 0.1, 0.3]

// A bookseller's arcade: a pale hall behind a row of piers, stalls of books under its awning.
function booksellersArcade({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  const hall = height * 0.66
  const eaves = 0.12 + hall
  const roof = height - eaves - 0.08
  return [
    box([0, 0.06, 0], [width, 0.12, depth], COURT.slate),
    box([0, 0.12 + hall / 2, -depth * 0.14], [width * 0.9, hall, depth * 0.56], COURT.marble),
    lit(
      box([0, 0.12 + hall * 0.8, depth * 0.14 + 0.02], [width * 0.8, hall * 0.1, 0.04], COURT.lumen)
    ),
    ...PIERS.map((spot) =>
      cylinder(
        [spot * width, 0.12 + hall * 0.3, depth * 0.36],
        [0.3, hall * 0.6, 0.3],
        COURT.marble
      )
    ),
    box([0, 0.16 + hall * 0.6, depth * 0.27], [width * 0.92, 0.08, depth * 0.3], accent),
    ...BOOK_STALLS.flatMap((spot, index) => [
      box([spot * width, 0.3, depth * 0.36], [width * 0.12, 0.36, 0.44], COURT.ink),
      box(
        [spot * width, 0.53, depth * 0.36],
        [width * 0.1, 0.1, 0.3],
        index % 2 ? COURT.crimson : COURT.ivory
      )
    ]),
    box([0, eaves + 0.04, -depth * 0.14], [width * 0.94, 0.08, depth * 0.6], COURT.gold),
    box(
      [0, eaves + 0.08 + roof * 0.3, -depth * 0.14],
      [width * 0.88, roof * 0.6, depth * 0.54],
      accent
    ),
    box(
      [0, eaves + 0.08 + roof * 0.8, -depth * 0.14],
      [width * 0.56, roof * 0.4, depth * 0.3],
      accent
    )
  ]
}

export const COURT_CIVIC_DESIGNS: readonly ZoneDesign[] = [
  { name: 'gatehouse', zones: ['civic'], height: { min: 3, max: 7 }, build: gatehouse },
  {
    name: 'booksellers-arcade',
    zones: ['market'],
    height: { min: 2.4, max: 5 },
    build: booksellersArcade
  }
]
