import { ball, box, tube } from '../citizens/figure-parts'
import type { VehicleDesign } from '../town/town-dress'
import { vehicleWheel, vehicleWheels } from './edo-town-vehicle-parts'
import { BRASS } from './palettes'

export const BRASS_VEHICLES: readonly VehicleDesign[] = [
  {
    name: 'brass omnibus',
    role: 'transit',
    parts: () => [
      ...vehicleWheels({ color: BRASS.ink, across: 0.67, radius: 0.28, axles: [-1, 1] }),
      box(BRASS.ink, [1.25, 0.18, 2.9], [0, 0.48, 0]),
      box(BRASS.copper, [1.22, 1.08, 2.62], [0, 1.1, 0]),
      ...[-1, 1].flatMap((side) =>
        [-0.84, 0, 0.84].map((along) =>
          box(BRASS.paper, [0.04, 0.5, 0.62], [side * 0.62, 1.26, along])
        )
      ),
      box(BRASS.brass, [1.4, 0.22, 2.86], [0, 1.79, 0]),
      box(BRASS.paper, [0.85, 0.5, 0.04], [0, 1.24, 1.32]),
      ...[-1, 1].map((side) => ball(BRASS.glow, 0.1, [side * 0.44, 0.8, 1.4])),
      tube(BRASS.brass, [0.11, 0.11, 0.55], [0.4, 1.5, -1.1])
    ]
  },
  {
    name: 'boiler lorry',
    role: 'freight',
    parts: () => [
      ...vehicleWheels({ color: BRASS.ink, across: 0.66, radius: 0.3, axles: [-0.94, 0.86] }),
      box(BRASS.ink, [1.24, 0.2, 2.6], [0, 0.5, 0]),
      box(BRASS.wood, [1.18, 0.16, 1.55], [0, 0.68, -0.5]),
      tube(BRASS.copper, [0.44, 0.44, 0.84], [0, 1.1, -0.58]),
      ...[0.8, 1.4].map((height) => tube(BRASS.brass, [0.47, 0.47, 0.08], [0, height, -0.58])),
      box(BRASS.copper, [1.15, 0.88, 0.8], [0, 1.02, 0.82]),
      box(BRASS.paper, [0.85, 0.4, 0.04], [0, 1.2, 1.23]),
      box(BRASS.brass, [1.3, 0.12, 0.92], [0, 1.52, 0.82]),
      tube(BRASS.ink, [0.1, 0.1, 0.68], [0.43, 1.15, 0.4]),
      ball(BRASS.glow, 0.1, [0, 0.84, 1.3])
    ]
  },
  {
    name: 'pedal velocipede',
    role: 'runabout',
    parts: () => {
      const wheels = [-0.48, 0.5].map((along) =>
        vehicleWheel({ color: BRASS.ink, across: 0, radius: 0.35, along })
      )
      return [
        ...wheels,
        box(BRASS.brass, [0.07, 0.07, 0.98], [0, 0.5, 0]),
        box(BRASS.copper, [0.07, 0.48, 0.07], [0, 0.66, -0.22]),
        box(BRASS.brass, [0.07, 0.68, 0.07], [0, 0.7, 0.5]),
        box(BRASS.wood, [0.3, 0.07, 0.24], [0, 0.92, -0.22]),
        box(BRASS.brass, [0.52, 0.06, 0.06], [0, 1.04, 0.5]),
        box(BRASS.copper, [0.38, 0.05, 0.08], [0, 0.35, 0]),
        ball(BRASS.glow, 0.06, [0, 0.92, 0.59])
      ]
    }
  }
]
