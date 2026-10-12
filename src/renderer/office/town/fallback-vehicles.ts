import { CylinderGeometry } from 'three'
import { ball, box, tube, type FigurePart } from '../citizens/figure-parts'
import type { ThemePalette } from '../themes/types'
import type { VehicleDesign, VehicleRole } from './town-dress'

// Plain vehicles in a theme's own palette, for a theme that has not drawn its own yet. Modelled
// like citizens: nose toward +z, wheels on y = 0, and drawn at the citizens' scale.

const WHEEL_SIDES = 10
const WHEEL_WIDTH = 0.1

// A wheel on each side of every axle, standing on the ground.
function wheels(color: string, radius: number, halfTrack: number, axles: number[]): FigurePart[] {
  return axles.flatMap((z) =>
    [-1, 1].map((side) => ({
      geometry: new CylinderGeometry(radius, radius, WHEEL_WIDTH, WHEEL_SIDES)
        .rotateZ(Math.PI / 2)
        .translate(side * halfTrack, radius, z),
      color
    }))
  )
}

// A two-wheeled cart with a load and a lamp: the runabout.
function cart(palette: ThemePalette): FigurePart[] {
  return [
    ...wheels(palette.ink, 0.28, 0.48, [0]),
    box(palette.wood, [0.8, 0.12, 1.3], [0, 0.46, 0]),
    box(palette.lacquer, [0.8, 0.22, 0.06], [0, 0.63, -0.62]),
    box(palette.lacquer, [0.06, 0.22, 1.3], [-0.37, 0.63, 0]),
    box(palette.lacquer, [0.06, 0.22, 1.3], [0.37, 0.63, 0]),
    box(palette.paper, [0.56, 0.3, 0.7], [0, 0.67, -0.15]),
    box(palette.gold, [0.6, 0.04, 0.74], [0, 0.84, -0.15]),
    box(palette.wood, [0.05, 0.05, 0.7], [-0.3, 0.46, 0.95]),
    box(palette.wood, [0.05, 0.05, 0.7], [0.3, 0.46, 0.95]),
    ball(palette.glow, 0.09, [0, 0.83, 0.6])
  ]
}

// A four-wheeled wagon with a driver's box and barrels behind: freight.
function wagon(palette: ThemePalette): FigurePart[] {
  return [
    ...wheels(palette.ink, 0.3, 0.6, [-0.8, 0.8]),
    box(palette.wood, [1.05, 0.16, 2.4], [0, 0.5, 0]),
    box(palette.copper, [1.05, 0.3, 0.06], [0, 0.73, -1.17]),
    box(palette.copper, [0.06, 0.3, 1.6], [-0.5, 0.73, -0.4]),
    box(palette.copper, [0.06, 0.3, 1.6], [0.5, 0.73, -0.4]),
    box(palette.lacquer, [0.95, 0.5, 0.6], [0, 0.83, 0.85]),
    box(palette.gold, [1.05, 0.05, 0.7], [0, 1.1, 0.85]),
    tube(palette.brass, [0.26, 0.26, 0.5], [-0.22, 0.83, -0.7]),
    tube(palette.brass, [0.26, 0.26, 0.5], [0.22, 0.83, -0.1]),
    box(palette.paper, [0.5, 0.4, 0.5], [0.2, 0.78, -0.75]),
    ball(palette.glow, 0.08, [0, 0.95, 1.2])
  ]
}

// A long coach with a lit window band and a raised roof: transit.
function coach(palette: ThemePalette): FigurePart[] {
  return [
    ...wheels(palette.ink, 0.3, 0.68, [-1.4, 1.4]),
    box(palette.lacquer, [1.45, 0.55, 4.2], [0, 0.6, 0]),
    box(palette.glow, [1.47, 0.42, 3.8], [0, 1.08, 0]),
    box(palette.lacquer, [1.49, 0.44, 0.14], [0, 1.08, -1.0]),
    box(palette.lacquer, [1.49, 0.44, 0.14], [0, 1.08, 1.0]),
    box(palette.lacquer, [1.45, 0.42, 0.2], [0, 1.08, 2.0]),
    box(palette.lacquer, [1.45, 0.42, 0.2], [0, 1.08, -2.0]),
    box(palette.gold, [1.5, 0.08, 4.3], [0, 0.9, 0]),
    box(palette.paper, [1.55, 0.14, 4.4], [0, 1.4, 0]),
    box(palette.gold, [0.9, 0.38, 3.4], [0, 1.66, 0]),
    ball(palette.glow, 0.12, [0, 0.7, 2.12])
  ]
}

const BUILDS: Record<
  VehicleRole,
  { name: string; build: (palette: ThemePalette) => FigurePart[] }
> = {
  transit: { name: 'Plain Coach', build: coach },
  freight: { name: 'Plain Wagon', build: wagon },
  runabout: { name: 'Plain Cart', build: cart }
}

export function fallbackVehicle(role: VehicleRole, palette: ThemePalette): VehicleDesign {
  const { name, build } = BUILDS[role]
  return { name, role, parts: () => build(palette) }
}
