import type { ZoneDesign, ZonePlot } from '../town/town-dress'
import { bandstand, fountainSquare } from './brass-town-parks'
import { BRASS_BUILDINGS } from './BrassSurroundings'
import { fitTownParts, legacyBuilding, legacyTownDesign, townBuilding } from './edo-town-legacy'
import { BRASS } from './palettes'
import { box, cone, cylinder, lit, sphere, type PartSpec } from './parts'

const roofOf = (part: PartSpec): boolean =>
  (part.color === BRASS.ink && part.shape === 'box' && part.size[1] <= 0.5 && part.at[1] > 0.8) ||
  (part.color === BRASS.copper && part.shape === 'cone')
const old = (name: string) => legacyBuilding(BRASS_BUILDINGS, name)

function hall(plot: ZonePlot): PartSpec[] {
  const body = plot.height * 0.76
  return [
    box(
      [0, body / 2, -plot.depth * 0.06],
      [plot.width * 0.82, body, plot.depth * 0.72],
      BRASS.wood
    ),
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((end) =>
        box(
          [side * plot.width * 0.39, body / 2, end * plot.depth * 0.33 - plot.depth * 0.06],
          [0.14, body, 0.14],
          BRASS.brass
        )
      )
    ),
    lit(
      box([0, body * 0.64, plot.depth * 0.31], [plot.width * 0.66, body * 0.18, 0.05], BRASS.glow)
    ),
    box([0, body * 0.28, plot.depth * 0.33], [plot.width * 0.2, body * 0.56, 0.06], BRASS.copper),
    box(
      [0, body + plot.height * 0.04, -plot.depth * 0.06],
      [plot.width * 0.92, plot.height * 0.08, plot.depth * 0.86],
      plot.accent
    ),
    box(
      [0, body + plot.height * 0.14, -plot.depth * 0.06],
      [plot.width * 0.48, plot.height * 0.12, plot.depth * 0.56],
      plot.accent
    )
  ]
}

function guildhall(plot: ZonePlot): PartSpec[] {
  return [
    ...hall(plot),
    ...[-1, 1].map((side) =>
      box(
        [side * plot.width * 0.28, plot.height * 0.25, plot.depth * 0.4],
        [0.2, plot.height * 0.5, 0.2],
        BRASS.brass
      )
    ),
    box(
      [0, plot.height * 0.52, plot.depth * 0.4],
      [plot.width * 0.68, plot.height * 0.06, 0.5],
      plot.accent
    ),
    cylinder([0, plot.height * 0.88, 0], [0.6, plot.height * 0.16, 0.6], BRASS.brass)
  ]
}

function fittersArcade(plot: ZonePlot): PartSpec[] {
  const bay = plot.width / 3
  return [-1, 0, 1].flatMap((step) => [
    box(
      [step * bay, plot.height * 0.18, 0],
      [bay * 0.76, plot.height * 0.36, plot.depth * 0.5],
      BRASS.wood
    ),
    ...[-1, 1].map((side) =>
      cylinder(
        [step * bay + side * bay * 0.35, plot.height * 0.4, plot.depth * 0.31],
        [0.14, plot.height * 0.8, 0.14],
        BRASS.brass
      )
    ),
    box(
      [step * bay, plot.height * 0.84, 0],
      [bay * 0.96, plot.height * 0.1, plot.depth * 0.88],
      plot.accent
    ),
    box([step * bay, plot.height * 0.39, plot.depth * 0.27], [bay * 0.6, 0.08, 0.35], BRASS.copper)
  ])
}

function musicHall(plot: ZonePlot): PartSpec[] {
  return [
    ...hall({ ...plot, height: plot.height * 0.78 }),
    ...[-2, -1, 0, 1, 2].map((step) =>
      cylinder(
        [
          step * plot.width * 0.12,
          plot.height * (0.56 - Math.abs(step) * 0.035),
          -plot.depth * 0.2
        ],
        [0.28, plot.height * (0.72 - Math.abs(step) * 0.07), 0.28],
        BRASS.brass
      )
    ),
    box(
      [0, plot.height * 0.79, 0],
      [plot.width * 0.76, plot.height * 0.1, plot.depth * 0.8],
      plot.accent
    ),
    cone(
      [0, plot.height * 0.92, 0],
      [plot.width * 0.26, plot.height * 0.16, plot.depth * 0.36],
      plot.accent
    ),
    box(
      [0, plot.height * 0.33, plot.depth * 0.38],
      [plot.width * 0.42, plot.height * 0.12, 0.08],
      BRASS.brass
    )
  ]
}

function automatonBooth(plot: ZonePlot): PartSpec[] {
  return [
    ...fittersArcade({ ...plot, height: plot.height * 0.8 }),
    cylinder(
      [0, plot.height * 0.25, plot.depth * 0.33],
      [0.5, plot.height * 0.22, 0.5],
      BRASS.copper
    ),
    sphere([0, plot.height * 0.42, plot.depth * 0.33], [0.4, 0.4, 0.4], BRASS.brass),
    box(
      [0, plot.height * 0.76, 0],
      [plot.width * 0.38, plot.height * 0.12, plot.depth * 0.5],
      plot.accent
    ),
    ...[-1, 1].map((side) =>
      box(
        [side * plot.width * 0.3, plot.height * 0.86, 0],
        [0.14, plot.height * 0.24, 0.14],
        BRASS.brass
      )
    )
  ]
}

function lodgingRow(plot: ZonePlot): PartSpec[] {
  const bay = plot.width / 3
  return [-1, 0, 1].flatMap((step) =>
    hall({ ...plot, width: bay * 0.98 }).map((part) => ({
      ...part,
      at: [part.at[0] + step * bay, part.at[1], part.at[2]]
    }))
  )
}

function tenement(plot: ZonePlot): PartSpec[] {
  return [
    ...hall(plot),
    ...[0.3, 0.52].map((level) =>
      lit(
        box(
          [0, plot.height * level, plot.depth * 0.31],
          [plot.width * 0.66, plot.height * 0.08, 0.06],
          BRASS.glow
        )
      )
    ),
    ...[-1, 0, 1].map((step) =>
      box(
        [step * plot.width * 0.22, plot.height * 0.62, plot.depth * 0.35],
        [0.1, plot.height * 0.3, 0.12],
        BRASS.brass
      )
    )
  ]
}

function boilerHouse(plot: ZonePlot): PartSpec[] {
  const parts = old('boiler house').parts(plot)
  const hallHeight = Math.min(plot.height - 1.8, 2.4)
  return fitTownParts(
    [
      ...parts,
      box([0, hallHeight + 0.06, 0], [plot.width * 0.94, 0.12, plot.depth * 0.94], plot.accent)
    ],
    plot
  )
}

function pipeYard(plot: ZonePlot): PartSpec[] {
  return fitTownParts(
    [
      ...old('pipe yard').parts(plot),
      ...[-1, 1].map((side) =>
        box(
          [side * plot.width * 0.4, plot.height * 0.4, -plot.depth * 0.3],
          [0.16, plot.height * 0.8, 0.16],
          BRASS.ink
        )
      ),
      box(
        [0, plot.height * 0.84, -plot.depth * 0.3],
        [plot.width * 0.9, plot.height * 0.08, plot.depth * 0.3],
        plot.accent
      )
    ],
    plot
  )
}

export const BRASS_TOWN_DESIGNS: readonly ZoneDesign[] = [
  legacyTownDesign({
    source: old('clock tower'),
    zones: ['civic'],
    max: 24,
    isLandmark: true,
    roof: roofOf
  }),
  townBuilding('guildhall', 'civic', 10, guildhall),
  legacyTownDesign({
    source: old('warehouse'),
    name: 'warehouse shopfront',
    zones: ['market'],
    max: 7,
    roof: roofOf
  }),
  townBuilding("arcade of fitters' stalls", 'market', 5, fittersArcade),
  townBuilding('music hall', 'entertainment', 12, musicHall, 5, true),
  townBuilding('automaton fairground booth', 'entertainment', 5, automatonBooth),
  townBuilding('lodging row', 'residential', 6, lodgingRow),
  townBuilding('terraced tenement', 'residential', 9, tenement),
  legacyTownDesign({
    source: old('foundry'),
    zones: ['workshop'],
    max: 12,
    isLandmark: true,
    roof: roofOf
  }),
  townBuilding('boiler house', 'workshop', 8, boilerHouse, 3),
  townBuilding('pipe yard', 'workshop', 5, pipeYard),
  legacyTownDesign({ source: old('gasometer'), zones: ['workshop'], max: 8, roof: roofOf }),
  townBuilding('bandstand green', 'park', 5, bandstand),
  townBuilding('iron-fenced fountain square', 'park', 4, fountainSquare)
]
