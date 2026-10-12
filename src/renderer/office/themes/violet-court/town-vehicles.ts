import { ball, box, cone, quadruped, tube } from '../../citizens/figure-parts'
import type { VehicleDesign } from '../../town/town-dress'
import { COURT } from './palette'
import { moved, wheel } from './town-vehicle-parts'

import { SIDES } from '../parts'

// What rides the court's roads. Each faces +z and stands on y = 0, a metre to the metre.
export const COURT_VEHICLES: readonly VehicleDesign[] = [
  {
    name: 'Banner Coach',
    role: 'transit',
    parts: () => [
      box(COURT.violet, [0.86, 0.8, 1.5], [0, 0.85, 0]),
      box(COURT.gold, [0.9, 0.06, 1.54], [0, 0.8, 0]),
      box(COURT.lumen, [0.88, 0.26, 0.9], [0, 1.02, 0]),
      box(COURT.ink, [0.96, 0.08, 1.64], [0, 1.29, 0]),
      box(COURT.gold, [0.04, 0.55, 0.04], [0, 1.6, -0.6]),
      box(COURT.crimson, [0.03, 0.3, 0.4], [0, 1.7, -0.38]),
      ball(COURT.gold, 0.05, [0, 1.9, -0.6]),
      ...SIDES.flatMap((side) => [
        wheel(COURT.gold, 0.3, [side * 0.48, 0.3, -0.45]),
        wheel(COURT.gold, 0.24, [side * 0.48, 0.24, 0.5]),
        box(COURT.lumen, [0.1, 0.14, 0.1], [side * 0.4, 1.1, 0.78]),
        box(COURT.ink, [0.04, 0.04, 0.7], [side * 0.2, 0.62, 1.05])
      ]),
      ...moved(
        quadruped({ coat: COURT.marble, length: 0.8, girth: 0.28, leg: 0.5, head: 0.12 }),
        [0, 0, 1.6]
      ),
      box(COURT.violet, [0.3, 0.04, 0.4], [0, 0.8, 1.6])
    ]
  },
  {
    name: 'Supply Wain',
    role: 'freight',
    parts: () => [
      box(COURT.ink, [0.8, 0.1, 1.4], [0, 0.5, 0]),
      box(COURT.marble, [0.4, 0.36, 0.4], [-0.14, 0.73, -0.4]),
      box(COURT.gold, [0.42, 0.05, 0.42], [-0.14, 0.76, -0.4]),
      box(COURT.violet, [0.34, 0.3, 0.36], [0.16, 0.7, 0.18]),
      tube(COURT.crimson, [0.16, 0.16, 0.4], [-0.16, 0.75, 0.3]),
      ball(COURT.ivory, 0.17, [0.18, 0.7, -0.36]),
      ...SIDES.flatMap((side) => [
        box(COURT.slate, [0.05, 0.25, 1.4], [side * 0.4, 0.66, 0]),
        wheel(COURT.slate, 0.28, [side * 0.46, 0.28, -0.45]),
        wheel(COURT.slate, 0.28, [side * 0.46, 0.28, 0.45]),
        box(COURT.ink, [0.04, 0.04, 0.7], [side * 0.2, 0.55, 1.0])
      ]),
      ...moved(
        quadruped({ coat: COURT.slate, length: 0.85, girth: 0.32, leg: 0.42, head: 0.13 }),
        [0, 0, 1.5]
      )
    ]
  },
  {
    name: 'Gilded Carriage',
    role: 'runabout',
    parts: () => [
      box(COURT.gold, [0.7, 0.34, 0.8], [0, 0.62, -0.1]),
      box(COURT.violet, [0.56, 0.1, 0.4], [0, 0.84, -0.2]),
      ball(COURT.violet, 0.36, [0, 0.95, -0.42]),
      cone(COURT.gold, 0.06, 0.14, [0, 1.36, -0.42]),
      ...SIDES.flatMap((side) => [
        wheel(COURT.gold, 0.34, [side * 0.42, 0.34, -0.1]),
        ball(COURT.lumen, 0.05, [side * 0.36, 0.9, 0.3]),
        box(COURT.gold, [0.03, 0.03, 0.9], [side * 0.18, 0.6, 0.7])
      ]),
      ...moved(
        quadruped({ coat: COURT.ivory, length: 0.8, girth: 0.26, leg: 0.5, head: 0.12 }),
        [0, 0, 1.3]
      )
    ]
  }
]
