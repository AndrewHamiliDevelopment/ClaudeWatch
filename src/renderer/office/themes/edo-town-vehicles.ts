import { ball, box, cone, tube } from '../citizens/figure-parts'
import type { VehicleDesign } from '../town/town-dress'
import { vehicleWheels } from './edo-town-vehicle-parts'
import { EDO } from './palettes'

export const EDO_VEHICLES: readonly VehicleDesign[] = [
  {
    name: 'steam tram',
    role: 'transit',
    parts: () => [
      ...vehicleWheels({ color: EDO.ink, across: 0.64, radius: 0.24, axles: [-0.92, 0.92] }),
      box(EDO.wood, [1.22, 0.24, 2.8], [0, 0.43, 0]),
      box(EDO.lacquer, [1.18, 0.48, 2.6], [0, 0.72, 0]),
      ...[-1, 1].flatMap((side) =>
        [-0.9, 0, 0.9].map((along) => box(EDO.paper, [0.04, 0.54, 0.68], [side * 0.6, 1.21, along]))
      ),
      ...[-1, 1].flatMap((side) =>
        [-1.18, 1.18].map((along) => box(EDO.brass, [0.1, 0.83, 0.1], [side * 0.53, 1.34, along]))
      ),
      box(EDO.copper, [1.38, 0.15, 2.9], [0, 1.825, 0]),
      box(EDO.ink, [0.5, 0.18, 1.2], [0, 1.66, -0.6]),
      tube(EDO.brass, [0.12, 0.12, 0.5], [0, 1.5, 1.1]),
      ball(EDO.glow, 0.12, [0, 0.85, 1.35])
    ]
  },
  {
    name: 'hand cart',
    role: 'freight',
    parts: () => [
      ...vehicleWheels({ color: EDO.ink, across: 0.56, radius: 0.3, axles: [0] }),
      box(EDO.wood, [1, 0.14, 1.1], [0, 0.45, -0.1]),
      box(EDO.wood, [0.8, 0.48, 0.78], [0, 0.76, -0.15]),
      box(EDO.lacquer, [0.82, 0.06, 0.8], [0, 0.82, -0.15]),
      ...[-1, 1].map((side) => box(EDO.wood, [0.07, 0.07, 1.2], [side * 0.38, 0.49, 0.8])),
      box(EDO.wood, [0.06, 0.38, 0.06], [0, 0.19, -0.5])
    ]
  },
  {
    name: 'lantern rickshaw',
    role: 'runabout',
    parts: () => [
      ...vehicleWheels({ color: EDO.ink, across: 0.55, radius: 0.4, axles: [-0.28] }),
      box(EDO.wood, [0.9, 0.14, 0.95], [0, 0.6, -0.18]),
      box(EDO.lacquer, [0.85, 0.42, 0.14], [0, 0.86, -0.57]),
      ...[-1, 1].map((side) => box(EDO.wood, [0.06, 0.06, 1.8], [side * 0.38, 0.56, 0.8])),
      ...[-1, 1].map((side) => box(EDO.brass, [0.05, 0.9, 0.05], [side * 0.4, 1.12, -0.46])),
      cone(EDO.copper, 0.63, 0.24, [0, 1.63, -0.2]),
      ...[-1, 1].map((side) => ball(EDO.glow, 0.11, [side * 0.42, 1.29, 0.21])),
      box(EDO.wood, [0.06, 0.55, 0.06], [0, 0.275, 0.15])
    ]
  }
]
