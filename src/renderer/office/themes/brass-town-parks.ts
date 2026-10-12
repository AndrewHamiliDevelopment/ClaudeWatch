import type { ZonePlot } from '../town/town-dress'
import { BRASS } from './palettes'
import { box, cone, cylinder, type PartSpec } from './parts'

export function bandstand(plot: ZonePlot): PartSpec[] {
  return [
    cylinder(
      [0, plot.height * 0.06, 0],
      [plot.width * 0.64, plot.height * 0.12, plot.depth * 0.64],
      BRASS.stone
    ),
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((end) =>
        cylinder(
          [side * plot.width * 0.2, plot.height * 0.4, end * plot.depth * 0.2],
          [0.13, plot.height * 0.8, 0.13],
          BRASS.brass
        )
      )
    ),
    cone(
      [0, plot.height * 0.86, 0],
      [plot.width * 0.74, plot.height * 0.28, plot.depth * 0.74],
      plot.accent
    )
  ]
}

export function fountainSquare(plot: ZonePlot): PartSpec[] {
  return [
    cylinder(
      [0, plot.height * 0.08, 0],
      [plot.width * 0.44, plot.height * 0.16, plot.depth * 0.44],
      BRASS.stone
    ),
    cylinder(
      [0, plot.height * 0.14, 0],
      [plot.width * 0.36, plot.height * 0.04, plot.depth * 0.36],
      '#78A69B'
    ),
    cylinder([0, plot.height * 0.3, 0], [0.2, plot.height * 0.6, 0.2], BRASS.brass),
    cone(
      [0, plot.height * 0.57, 0],
      [plot.width * 0.2, plot.height * 0.12, plot.depth * 0.2],
      plot.accent
    ),
    ...[-1, 1].flatMap((side) => [
      ...[-2, -1, 0, 1, 2].map((step) =>
        box(
          [side * plot.width * 0.43, plot.height * 0.18, step * plot.depth * 0.18],
          [0.08, plot.height * 0.36, 0.08],
          BRASS.ink
        )
      ),
      box(
        [side * plot.width * 0.43, plot.height * 0.27, 0],
        [0.09, 0.08, plot.depth * 0.8],
        BRASS.ink
      ),
      box([0, plot.height * 0.24, -plot.depth * 0.43], [plot.width * 0.88, 0.08, 0.09], BRASS.ink)
    ])
  ]
}
