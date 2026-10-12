import { box, cone, cylinder, sphere, type PartSpec } from '../themes/parts'
import type { ThemePalette } from '../themes/types'
import type { ZoneDesign, ZonePlot, ZoneProp } from './town-dress'
import type { TownDistrict } from './town-zones'

// Walls with a part on top, each a share of the plot: the one shape most of these buildings are.
function topped(
  plot: ZonePlot,
  wall: string,
  walls: { footprint: number; height: number },
  top: (at: PartSpec['at'], size: PartSpec['size'], color: string) => PartSpec,
  overhang = 1.08
): PartSpec[] {
  const wallHeight = plot.height * walls.height
  const width = plot.width * walls.footprint
  const depth = plot.depth * walls.footprint
  return [
    box([0, wallHeight / 2, 0], [width, wallHeight, depth], wall),
    top(
      [0, (plot.height + wallHeight) / 2, 0],
      [width * overhang, plot.height - wallHeight, depth * overhang],
      plot.accent
    )
  ]
}

// A stack of parts on the lot's centre, each a share of the plot's height, the last in the accent.
function stacked(
  plot: ZonePlot,
  across: number,
  tiers: readonly (readonly [typeof box, number, number, string])[]
): PartSpec[] {
  let foot = 0
  return tiers.map(([shape, share, footprint, color]) => {
    const height = plot.height * share
    foot += height
    return shape([0, foot - height / 2, 0], [across * footprint, height, across * footprint], color)
  })
}

function design(
  name: string,
  zones: readonly TownDistrict[],
  height: ZoneDesign['height'],
  build: ZoneDesign['build']
): ZoneDesign {
  return { name, zones, height, build }
}

const narrowSide = (plot: ZonePlot): number => Math.min(plot.width, plot.depth)

// Two heights to a built zone, so the far ring can stand taller than the streets by the campus.
export function fallbackDesigns(palette: ThemePalette): ZoneDesign[] {
  const { paper, stone, wood, steam, ink } = palette
  return [
    design('fallback-house', ['residential'], { min: 2, max: 6 }, (plot) =>
      topped(plot, paper, { footprint: 0.78, height: 0.58 }, cone)
    ),
    design('fallback-tenement', ['residential'], { min: 6, max: 18 }, (plot) =>
      topped(plot, paper, { footprint: 0.8, height: 0.94 }, box)
    ),
    design('fallback-stalls', ['market'], { min: 2, max: 4.5 }, (plot) => [
      ...topped(plot, wood, { footprint: 0.8, height: 0.72 }, box),
      box(
        [0, plot.height * 0.6, plot.depth * 0.43],
        [plot.width * 0.86, plot.height * 0.1, plot.depth * 0.12],
        plot.accent
      )
    ]),
    design('fallback-arcade', ['market'], { min: 4.5, max: 14 }, (plot) =>
      topped(plot, paper, { footprint: 0.82, height: 0.9 }, box)
    ),
    design('fallback-pavilion', ['entertainment'], { min: 2.5, max: 8 }, (plot) =>
      stacked(plot, narrowSide(plot), [
        [cylinder, 0.5, 0.72, steam],
        [cone, 0.5, 0.94, plot.accent]
      ])
    ),
    design('fallback-playhouse', ['entertainment'], { min: 8, max: 22 }, (plot) => {
      const walls = plot.height * 0.78
      const dome = narrowSide(plot) * 0.7
      return [
        box([0, walls / 2, 0], [plot.width * 0.84, walls, plot.depth * 0.84], steam),
        // Half the sphere is inside the walls: the dome is what shows.
        sphere([0, walls, 0], [dome, (plot.height - walls) * 2, dome], plot.accent)
      ]
    }),
    design('fallback-shed', ['workshop'], { min: 2.5, max: 8 }, (plot) => [
      ...topped(plot, stone, { footprint: 0.84, height: 0.62 }, box, 1),
      cylinder(
        [plot.width * 0.26, plot.height / 2, -plot.depth * 0.24],
        [0.7, plot.height, 0.7],
        ink
      )
    ]),
    design('fallback-works', ['workshop'], { min: 8, max: 22 }, (plot) => [
      ...topped(plot, stone, { footprint: 0.84, height: 0.7 }, box, 1),
      ...[-1, 1].map((side) =>
        cylinder(
          [side * plot.width * 0.22, plot.height / 2, -plot.depth * 0.2],
          [narrowSide(plot) * 0.24, plot.height, narrowSide(plot) * 0.24],
          ink
        )
      )
    ]),
    design('fallback-hall', ['civic'], { min: 2.5, max: 10 }, (plot) =>
      stacked(plot, narrowSide(plot), [
        [box, 0.5, 0.9, steam],
        [box, 0.3, 0.6, paper],
        [cone, 0.2, 0.7, plot.accent]
      ])
    ),
    {
      ...design('fallback-spire', ['civic'], { min: 8, max: 24 }, (plot) =>
        stacked(plot, narrowSide(plot), [
          [box, 0.6, 0.8, steam],
          [box, 0.2, 0.5, paper],
          [cone, 0.2, 0.6, plot.accent]
        ])
      ),
      isLandmark: true
    },
    design('fallback-grove', ['park'], { min: 2, max: 5 }, (plot) => {
      const crown = narrowSide(plot) * 0.34
      const trunk = plot.height * 0.4
      const trees: readonly (readonly [number, number])[] = [
        [-0.26, -0.2],
        [0.26, -0.14],
        [0, 0.26]
      ]
      return trees.flatMap(([x, z]) => [
        cylinder([x * plot.width, trunk / 2, z * plot.depth], [0.3, trunk, 0.3], wood),
        sphere(
          [x * plot.width, (plot.height + trunk) / 2, z * plot.depth],
          [crown, plot.height - trunk, crown],
          plot.accent
        )
      ])
    })
  ]
}

// `leaf` is the park's own green: no palette carries one.
export function fallbackProps(palette: ThemePalette, leaf: string): ZoneProp[] {
  const { ink, glow, wood, brass, stone } = palette
  return [
    {
      name: 'fallback-lamp',
      zones: ['civic', 'market', 'entertainment', 'residential'],
      size: [0.4, 1.75, 0.4],
      parts: [
        cylinder([0, 0.75, 0], [0.12, 1.5, 0.12], ink),
        sphere([0, 1.58, 0], [0.34, 0.34, 0.34], glow)
      ]
    },
    {
      name: 'fallback-crates',
      zones: ['workshop', 'market'],
      size: [1.6, 0.9, 0.9],
      parts: [
        box([-0.4, 0.3, 0], [0.8, 0.6, 0.8], wood),
        box([0.45, 0.25, 0.05], [0.6, 0.5, 0.6], brass),
        box([-0.35, 0.75, 0], [0.5, 0.3, 0.5], brass)
      ]
    },
    {
      name: 'fallback-planter',
      zones: ['park', 'residential', 'civic'],
      size: [1.4, 0.95, 0.7],
      parts: [
        box([0, 0.18, 0], [1.4, 0.36, 0.7], stone),
        sphere([-0.35, 0.62, 0], [0.6, 0.6, 0.6], leaf),
        sphere([0.35, 0.58, 0], [0.5, 0.5, 0.5], leaf)
      ]
    }
  ]
}
