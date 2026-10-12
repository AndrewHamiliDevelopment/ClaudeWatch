import { box, lit, SIDES, turned, cone, cylinder, sphere } from '../parts'
import type { LotKit, PropDesign } from '../lot-kit'
import { GROVE_BUILDINGS } from './grove-buildings'
import { GROVE } from './palette'
import { ON_ITS_SIDE } from './spirit-features'

// What lines the outside of a company's wall. Each is sized as [length, height, reach].
const GROVE_PROPS: readonly PropDesign[] = [
  {
    name: 'log-pile',
    size: [1.3, 0.55, 0.6],
    parts: [
      ...SIDES.map((side) =>
        turned(cylinder([0, 0.13, side * 0.14], [0.26, 1.2, 0.26], GROVE.bark), ON_ITS_SIDE)
      ),
      turned(cylinder([0.04, 0.36, 0], [0.26, 1.1, 0.26], GROVE.bark), ON_ITS_SIDE)
    ]
  },
  {
    name: 'stone-lantern',
    size: [0.5, 1, 0.5],
    parts: [
      sphere([0, 0.1, 0], [0.46, 0.2, 0.46], GROVE.stone),
      cylinder([0, 0.4, 0], [0.12, 0.5, 0.12], GROVE.bark),
      lit(sphere([0, 0.74, 0], [0.26, 0.26, 0.26], GROVE.lumen)),
      sphere([0, 0.92, 0], [0.42, 0.14, 0.42], GROVE.stone)
    ]
  },
  {
    name: 'boulders',
    size: [1.2, 0.6, 0.7],
    parts: [
      sphere([-0.22, 0.24, 0], [0.7, 0.5, 0.6], GROVE.stone),
      sphere([0.3, 0.16, 0.08], [0.5, 0.34, 0.44], GROVE.stone),
      sphere([-0.2, 0.46, 0.02], [0.5, 0.2, 0.44], GROVE.moss),
      sphere([0.06, 0.08, -0.22], [0.26, 0.16, 0.22], GROVE.stone)
    ]
  },
  {
    name: 'glow-caps',
    size: [0.9, 0.5, 0.6],
    parts: [
      [-0.26, 0.34, 0.05],
      [0.06, 0.22, -0.12],
      [0.3, 0.28, 0.1]
    ].flatMap(([x, tall, z]) => [
      cylinder([x, tall / 2, z], [0.07, tall, 0.07], GROVE.bark),
      lit(sphere([x, tall + 0.05, z], [0.26, 0.14, 0.26], GROVE.lumen))
    ])
  },
  {
    name: 'plank-bench',
    size: [1.4, 0.45, 0.5],
    parts: [
      box([0, 0.36, 0], [1.3, 0.07, 0.4], GROVE.timber),
      ...SIDES.map((side) => cylinder([side * 0.45, 0.16, 0], [0.3, 0.32, 0.3], GROVE.bark))
    ]
  },
  {
    name: 'sapling',
    size: [0.6, 1.8, 0.6],
    parts: [
      box([0, 0.12, 0], [0.5, 0.24, 0.5], GROVE.timber),
      cylinder([0, 0.6, 0], [0.08, 0.8, 0.08], GROVE.bark),
      cone([0, 1.1, 0], [0.58, 0.7, 0.58], GROVE.pine),
      cone([0, 1.48, 0], [0.4, 0.6, 0.4], GROVE.pine)
    ]
  },
  {
    name: 'water-trough',
    size: [1.3, 0.45, 0.5],
    parts: [
      box([0, 0.24, 0], [1.2, 0.3, 0.44], GROVE.timber),
      box([0, 0.395, 0], [1.08, 0.02, 0.32], GROVE.pond),
      ...SIDES.map((side) => box([side * 0.5, 0.05, 0], [0.14, 0.1, 0.48], GROVE.bark))
    ]
  },
  {
    name: 'moss-bed',
    size: [1.2, 0.55, 0.6],
    parts: [
      box([0, 0.12, 0], [1.16, 0.24, 0.56], GROVE.bark),
      ...[-0.36, 0, 0.36].map((x) => sphere([x, 0.32, 0], [0.4, 0.4, 0.4], GROVE.moss))
    ]
  }
]

export const GROVE_LOT_KIT: LotKit = { buildings: GROVE_BUILDINGS, props: GROVE_PROPS }
