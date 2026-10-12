import { box, lit, SIDES, cone, cylinder, sphere } from '../parts'
import { COURT_BUILDINGS } from './court-buildings'
import type { LotKit, PropDesign } from '../lot-kit'
import { COURT } from './palette'

const LANCE_SPOTS = [-0.36, -0.12, 0.12, 0.36]

// What lines the outside of a company's wall. Each is sized as [length, height, reach].
const COURT_PROPS: readonly PropDesign[] = [
  {
    name: 'lamp-post',
    size: [0.5, 1.9, 0.5],
    parts: [
      box([0, 0.06, 0], [0.4, 0.12, 0.4], COURT.slate),
      box([0, 0.85, 0], [0.08, 1.5, 0.08], COURT.ink),
      lit(box([0, 1.68, 0], [0.22, 0.26, 0.22], COURT.lumen)),
      box([0, 1.85, 0], [0.3, 0.06, 0.3], COURT.gold)
    ]
  },
  {
    name: 'banner-stand',
    size: [0.9, 2.1, 0.4],
    parts: [
      box([0, 0.05, 0], [0.5, 0.1, 0.36], COURT.slate),
      box([0, 1.05, 0], [0.07, 2, 0.07], COURT.ink),
      box([0, 1.95, 0], [0.8, 0.06, 0.06], COURT.gold),
      box([0, 1.45, 0.03], [0.6, 0.9, 0.03], COURT.violet)
    ]
  },
  {
    name: 'topiary',
    size: [1.2, 1.1, 0.6],
    parts: SIDES.flatMap((side) => [
      box([side * 0.32, 0.15, 0], [0.44, 0.3, 0.44], COURT.slate),
      box([side * 0.32, 0.3, 0], [0.48, 0.04, 0.48], COURT.gold),
      sphere([side * 0.32, 0.6, 0], [0.5, 0.6, 0.5], COURT.violet),
      sphere([side * 0.32, 0.95, 0], [0.3, 0.3, 0.3], COURT.violet)
    ])
  },
  {
    name: 'statue',
    size: [0.7, 1.7, 0.7],
    parts: [
      cylinder([0, 0.3, 0], [0.6, 0.6, 0.6], COURT.marble),
      box([0, 0.63, 0], [0.66, 0.06, 0.66], COURT.gold),
      box([0, 1, 0], [0.26, 0.7, 0.2], COURT.ink),
      box([0, 1, -0.12], [0.34, 0.6, 0.04], COURT.violet),
      box([0, 1.42, 0], [0.16, 0.16, 0.16], COURT.ink),
      cone([0, 1.6, 0], [0.12, 0.2, 0.12], COURT.gold)
    ]
  },
  {
    name: 'bench',
    size: [1.4, 0.55, 0.5],
    parts: [
      box([0, 0.36, 0], [1.3, 0.08, 0.42], COURT.slate),
      box([0, 0.43, 0], [1.1, 0.06, 0.34], COURT.violet),
      ...SIDES.flatMap((side) => [
        box([side * 0.5, 0.16, 0], [0.12, 0.32, 0.4], COURT.ink),
        box([side * 0.66, 0.42, 0], [0.06, 0.2, 0.44], COURT.gold)
      ])
    ]
  },
  {
    name: 'urns',
    size: [1.3, 0.8, 0.5],
    parts: [
      box([0, 0.03, 0], [1.26, 0.06, 0.46], COURT.slate),
      ...SIDES.flatMap((side) => [
        cylinder([side * 0.4, 0.25, 0], [0.36, 0.44, 0.36], COURT.marble),
        sphere([side * 0.4, 0.58, 0], [0.44, 0.4, 0.44], COURT.violet)
      ])
    ]
  },
  {
    name: 'lance-rack',
    size: [1.4, 1.6, 0.5],
    parts: [
      box([0, 0.05, 0], [1.3, 0.1, 0.44], COURT.slate),
      box([0, 1, 0], [1.28, 0.06, 0.08], COURT.gold),
      ...SIDES.map((side) => box([side * 0.6, 0.6, 0], [0.08, 1.1, 0.08], COURT.ink)),
      ...LANCE_SPOTS.flatMap((x) => [
        box([x, 0.78, 0.06], [0.04, 1.4, 0.04], COURT.ink),
        cone([x, 1.5, 0.06], [0.1, 0.16, 0.1], COURT.gold)
      ])
    ]
  },
  {
    name: 'brazier',
    size: [0.6, 0.9, 0.6],
    parts: [
      cylinder([0, 0.3, 0], [0.3, 0.6, 0.3], COURT.marble),
      box([0, 0.64, 0], [0.5, 0.1, 0.5], COURT.ink),
      lit(box([0, 0.78, 0], [0.34, 0.2, 0.34], COURT.lumen))
    ]
  }
]

export const COURT_LOT_KIT: LotKit = { buildings: COURT_BUILDINGS, props: COURT_PROPS }
