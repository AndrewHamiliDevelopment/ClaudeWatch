import type { LotDesign } from './lot-parts'
import { EDO } from './palettes'
import { box, cone, lit, sphere } from './parts'

const { wood, ink, paper, lacquer, glow, copper, blossom } = EDO

// Street furniture for a 1 × 0.8 m spot, at most 1.6 m tall.
export const EDO_PROPS: readonly LotDesign[] = [
  {
    name: 'stone lantern',
    minHeight: 0,
    parts: () => [
      box([0, 0.06, 0], [0.4, 0.12, 0.4], ink),
      box([0, 0.52, 0], [0.14, 0.8, 0.14], ink),
      lit(box([0, 1.07, 0], [0.34, 0.3, 0.34], glow)),
      box([0, 1.27, 0], [0.5, 0.1, 0.5], ink)
    ]
  },
  {
    name: 'crate stack',
    minHeight: 0,
    parts: () => [
      box([-0.22, 0.25, 0], [0.5, 0.5, 0.5], wood),
      box([0.24, 0.21, 0.1], [0.42, 0.42, 0.42], wood),
      box([-0.15, 0.7, 0], [0.4, 0.4, 0.4], wood),
      box([-0.22, 0.3, 0], [0.52, 0.08, 0.52], lacquer)
    ]
  },
  {
    name: 'sake casks',
    minHeight: 0,
    parts: () => [
      ...[-0.24, 0.24].flatMap((x) => [
        box([x, 0.25, 0], [0.42, 0.5, 0.42], paper),
        box([x, 0.4, 0], [0.44, 0.07, 0.44], ink)
      ]),
      box([0, 0.75, 0], [0.42, 0.5, 0.42], paper),
      box([0, 0.9, 0], [0.44, 0.07, 0.44], ink),
      box([0, 0.72, 0.215], [0.2, 0.2, 0.02], lacquer)
    ]
  },
  {
    name: 'potted pine',
    minHeight: 0,
    parts: () => [
      box([0, 0.15, 0], [0.45, 0.3, 0.45], wood),
      box([0, 0.55, 0], [0.1, 0.5, 0.1], wood),
      cone([0, 0.9, 0], [0.7, 0.6, 0.7], copper),
      cone([0, 1.25, 0], [0.5, 0.5, 0.5], copper)
    ]
  },
  {
    name: 'blossom sapling',
    minHeight: 0,
    parts: () => [
      box([0, 0.45, 0], [0.12, 0.9, 0.12], wood),
      sphere([0, 1.15, 0], [0.75, 0.6, 0.75], blossom),
      sphere([0.25, 0.95, 0.1], [0.45, 0.4, 0.45], blossom)
    ]
  },
  {
    name: 'signboard',
    minHeight: 0,
    parts: () => [
      ...[-0.4, 0.4].map((x) => box([x, 0.6, 0], [0.08, 1.2, 0.08], wood)),
      box([0, 1, 0], [0.9, 0.5, 0.06], paper),
      box([0, 1.3, 0], [0.9, 0.1, 0.07], lacquer)
    ]
  },
  {
    name: 'hand cart',
    minHeight: 0,
    parts: () => [
      box([0, 0.4, 0], [0.8, 0.12, 0.5], wood),
      ...[-0.43, 0.43].map((x) => box([x, 0.22, 0], [0.06, 0.44, 0.44], ink)),
      box([0, 0.61, 0], [0.45, 0.3, 0.38], lacquer),
      box([0, 0.5, 0.33], [0.7, 0.06, 0.06], wood)
    ]
  },
  {
    name: 'banner pole',
    minHeight: 0,
    parts: () => [
      box([-0.2, 0.775, 0], [0.07, 1.55, 0.07], ink),
      box([0.04, 1.05, 0], [0.4, 0.9, 0.03], lacquer),
      box([0.04, 1.2, 0], [0.2, 0.2, 0.04], paper)
    ]
  }
]
