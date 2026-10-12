import type { LotDesign } from './lot-parts'
import { BRASS } from './palettes'
import { box, cone, cylinder, lit, turned } from './parts'

const { ink: iron, wood, brass, copper, glow } = BRASS
const ON_SIDE_X: [number, number, number] = [0, 0, Math.PI / 2]
const ON_SIDE_Z: [number, number, number] = [Math.PI / 2, 0, 0]

// Yard clutter for a 1 × 0.8 m spot, at most 1.6 m tall.
export const BRASS_PROPS: readonly LotDesign[] = [
  {
    name: 'gas lamp',
    minHeight: 0,
    parts: () => [
      box([0, 0.06, 0], [0.36, 0.12, 0.36], iron),
      box([0, 0.66, 0], [0.1, 1.2, 0.1], iron),
      box([0, 1.2, 0], [0.4, 0.06, 0.06], brass),
      lit(box([0, 1.37, 0], [0.26, 0.3, 0.26], glow)),
      box([0, 1.54, 0], [0.34, 0.06, 0.34], iron)
    ]
  },
  {
    name: 'strapped crates',
    minHeight: 0,
    parts: () => [
      box([-0.2, 0.28, 0], [0.56, 0.56, 0.56], wood),
      box([0.28, 0.2, 0.08], [0.4, 0.4, 0.4], wood),
      box([-0.2, 0.28, 0], [0.58, 0.08, 0.58], brass),
      box([-0.12, 0.76, 0], [0.4, 0.4, 0.4], wood)
    ]
  },
  {
    name: 'oil drums',
    minHeight: 0,
    parts: () =>
      [-0.25, 0.25].flatMap((x) => [
        cylinder([x, 0.32, 0], [0.44, 0.64, 0.44], copper),
        cylinder([x, 0.18, 0], [0.47, 0.06, 0.47], brass),
        cylinder([x, 0.48, 0], [0.47, 0.06, 0.47], brass)
      ])
  },
  {
    name: 'valve standpipe',
    minHeight: 0,
    parts: () => [
      cylinder([-0.25, 0.45, 0], [0.22, 0.9, 0.22], copper),
      turned(cylinder([0.05, 0.9, 0], [0.22, 0.82, 0.22], copper), ON_SIDE_X),
      turned(cylinder([-0.25, 0.9, 0.16], [0.46, 0.06, 0.46], brass), ON_SIDE_Z),
      box([0.4, 0.45, 0], [0.12, 0.9, 0.12], iron)
    ]
  },
  {
    name: 'cog pile',
    minHeight: 0,
    parts: () => [
      cylinder([0, 0.06, 0], [0.7, 0.12, 0.7], brass),
      cylinder([0.1, 0.18, 0.05], [0.5, 0.12, 0.5], brass),
      cylinder([-0.05, 0.3, 0], [0.34, 0.12, 0.34], brass),
      box([-0.05, 0.5, 0], [0.1, 0.5, 0.1], iron)
    ]
  },
  {
    name: 'workbench',
    minHeight: 0,
    parts: () => [
      box([0, 0.72, 0], [0.95, 0.08, 0.5], wood),
      ...[-0.4, 0.4].map((x) => box([x, 0.34, 0], [0.08, 0.68, 0.44], iron)),
      box([-0.25, 0.86, 0], [0.22, 0.2, 0.16], brass),
      box([0.22, 0.84, 0.05], [0.3, 0.16, 0.14], iron)
    ]
  },
  {
    name: 'ore cart',
    minHeight: 0,
    parts: () => [
      box([0, 0.46, 0], [0.72, 0.4, 0.5], iron),
      box([0, 0.7, 0], [0.56, 0.14, 0.38], wood),
      ...[-0.22, 0.22].flatMap((x) =>
        [-0.28, 0.28].map((z) => turned(cylinder([x, 0.15, z], [0.3, 0.06, 0.3], brass), ON_SIDE_Z))
      )
    ]
  },
  {
    name: 'steam vent',
    minHeight: 0,
    parts: () => [
      box([0, 0.05, 0], [0.62, 0.1, 0.62], iron),
      cylinder([0, 0.45, 0], [0.3, 0.7, 0.3], copper),
      cylinder([0, 0.6, 0], [0.34, 0.06, 0.34], brass),
      cone([0, 0.95, 0], [0.52, 0.3, 0.52], copper)
    ]
  }
]
