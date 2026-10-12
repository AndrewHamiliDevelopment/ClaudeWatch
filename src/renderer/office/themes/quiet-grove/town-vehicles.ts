import { ball, box, cone, person, quadruped, tube } from '../../citizens/figure-parts'
import type { VehicleDesign } from '../../town/town-dress'
import { laid, moved, wheel } from '../violet-court/town-vehicle-parts'
import { GROVE } from './palette'

const SIDES = [-1, 1] as const

// What rides the grove's tracks. Each faces +z and stands on y = 0, a metre to the metre.
export const GROVE_VEHICLES: readonly VehicleDesign[] = [
  {
    name: 'Pony Trap',
    role: 'transit',
    parts: () => [
      box(GROVE.timber, [0.74, 0.3, 0.9], [0, 0.6, -0.1]),
      box(GROVE.fern, [0.76, 0.05, 0.92], [0, 0.77, -0.1]),
      box(GROVE.bark, [0.6, 0.08, 0.3], [0, 0.82, -0.25]),
      box(GROVE.paper, [0.8, 0.05, 0.96], [0, 1.37, -0.1]),
      ball(GROVE.lumen, 0.06, [0, 1.27, 0.4]),
      ...SIDES.flatMap((side) => [
        wheel(GROVE.bark, 0.32, [side * 0.44, 0.32, -0.1]),
        box(GROVE.bark, [0.04, 0.6, 0.04], [side * 0.33, 1.05, -0.48]),
        box(GROVE.bark, [0.04, 0.6, 0.04], [side * 0.33, 1.05, 0.28]),
        box(GROVE.bark, [0.03, 0.03, 0.8], [side * 0.16, 0.5, 0.75])
      ]),
      ...moved(
        quadruped({ coat: GROVE.clay, length: 0.6, girth: 0.24, leg: 0.34, head: 0.11 }),
        [0, 0, 1.2]
      ),
      box(GROVE.bark, [0.04, 0.1, 0.2], [0, 0.66, 1.4])
    ]
  },
  {
    name: 'Timber Wagon',
    role: 'freight',
    parts: () => [
      box(GROVE.timber, [0.7, 0.08, 1.8], [0, 0.5, 0]),
      laid(GROVE.bark, 0.16, 1.7, [-0.17, 0.7, 0]),
      laid(GROVE.bark, 0.16, 1.7, [0.17, 0.7, 0]),
      laid(GROVE.timber, 0.15, 1.6, [0, 0.96, 0]),
      ...SIDES.flatMap((side) => [
        wheel(GROVE.bark, 0.26, [side * 0.42, 0.26, -0.6]),
        wheel(GROVE.bark, 0.26, [side * 0.42, 0.26, 0.6]),
        box(GROVE.bark, [0.05, 0.4, 0.05], [side * 0.34, 0.74, -0.7]),
        box(GROVE.bark, [0.05, 0.4, 0.05], [side * 0.34, 0.74, 0.7]),
        box(GROVE.bark, [0.04, 0.04, 0.7], [side * 0.22, 0.52, 1.2])
      ]),
      ...moved(
        quadruped({ coat: GROVE.bark, length: 0.9, girth: 0.36, leg: 0.4, head: 0.14 }),
        [0, 0, 1.8]
      ),
      box(GROVE.paper, [0.34, 0.03, 0.03], [0, 0.94, 2.28])
    ]
  },
  {
    name: 'Garden Barrow',
    role: 'runabout',
    parts: () => [
      ...moved(person({ robe: GROVE.pine, coat: GROVE.clay, hair: GROVE.soil }), [0, 0, -0.45]),
      cone(GROVE.timber, 0.22, 0.1, [0, 1.05, -0.45]),
      box(GROVE.timber, [0.44, 0.2, 0.6], [0, 0.42, 0.25]),
      wheel(GROVE.bark, 0.16, [0, 0.16, 0.62]),
      ball(GROVE.moss, 0.16, [-0.06, 0.6, 0.2]),
      tube(GROVE.clay, [0.09, 0.07, 0.14], [0.1, 0.59, 0.38]),
      ball(GROVE.fern, 0.1, [0.1, 0.72, 0.38]),
      ...SIDES.flatMap((side) => [
        box(GROVE.bark, [0.04, 0.32, 0.04], [side * 0.18, 0.16, 0.05]),
        box(GROVE.bark, [0.03, 0.03, 0.5], [side * 0.2, 0.5, -0.2])
      ])
    ]
  }
]
