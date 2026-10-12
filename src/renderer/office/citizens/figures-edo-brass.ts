import { STEAM } from '../office-palette'
import { EDO } from '../themes/palettes'
import { ball, box, cone, person, quadruped, tube, type CitizenFigure } from './figure-parts'

// Neo Edo Steam: the lantern-lit streets round the pagoda district.
export const EDO_CITIZENS: readonly CitizenFigure[] = [
  {
    name: 'Lantern Walker',
    parts: () => [
      ...person({ robe: EDO.lacquer, coat: EDO.paper, hair: EDO.ink }),
      cone(EDO.gold, 0.21, 0.1, [0, 1.05, 0]),
      box(EDO.wood, [0.03, 0.03, 0.32], [0.18, 0.66, 0.16]),
      ball(EDO.glow, 0.08, [0.18, 0.54, 0.32])
    ]
  },
  {
    name: 'Yoke Vendor',
    parts: () => [
      ...person({ robe: EDO.copper, coat: EDO.paper, hair: EDO.ink }),
      box(EDO.lacquer, [0.24, 0.04, 0.24], [0, 0.97, 0]),
      box(EDO.wood, [0.92, 0.03, 0.03], [0, 0.8, 0]),
      ...[-0.43, 0.43].flatMap((x) => [
        box(EDO.wood, [0.012, 0.26, 0.012], [x, 0.66, 0]),
        tube(EDO.gold, [0.11, 0.08, 0.15], [x, 0.46, 0]),
        ball(EDO.blossom, 0.07, [x, 0.55, 0])
      ])
    ]
  },
  {
    name: 'Parasol Stroller',
    parts: () => [
      ...person({ robe: EDO.blossom, coat: EDO.paper, hair: EDO.ink }),
      ball(EDO.ink, 0.06, [0, 1.02, -0.04]),
      box(EDO.wood, [0.02, 0.42, 0.02], [0.12, 0.98, 0]),
      cone(EDO.lacquer, 0.34, 0.12, [0.12, 1.23, 0])
    ]
  },
  {
    name: 'Alley Cat',
    parts: () => [
      ...quadruped({ coat: EDO.paper, length: 0.34, girth: 0.14, leg: 0.12, head: 0.09 }),
      cone(EDO.ink, 0.03, 0.07, [-0.045, 0.39, 0.2]),
      cone(EDO.ink, 0.03, 0.07, [0.045, 0.39, 0.2]),
      box(EDO.ink, [0.03, 0.24, 0.03], [0, 0.34, -0.17]),
      box(EDO.lacquer, [0.15, 0.03, 0.04], [0, 0.27, 0.12])
    ]
  }
]

// Brass Workshop: the people who keep the foundry quarter running.
export const BRASS_CITIZENS: readonly CitizenFigure[] = [
  {
    name: 'Goggled Artisan',
    parts: () => [
      ...person({ robe: STEAM.floorWood, coat: STEAM.copper, hair: STEAM.iron }),
      box(STEAM.cream, [0.22, 0.42, 0.03], [0, 0.5, 0.16]),
      box(STEAM.brass, [0.2, 0.05, 0.05], [0, 0.93, 0.09]),
      box(STEAM.ironLight, [0.04, 0.3, 0.04], [0.2, 0.6, 0.06]),
      box(STEAM.ironLight, [0.1, 0.06, 0.04], [0.2, 0.76, 0.06])
    ]
  },
  {
    name: 'Parcel Courier',
    parts: () => [
      ...person({ robe: STEAM.brass, coat: STEAM.cream, hair: STEAM.copper }),
      box(STEAM.copper, [0.16, 0.03, 0.12], [0, 0.99, 0.12]),
      box(STEAM.floorWood, [0.26, 0.24, 0.18], [0, 0.72, -0.22]),
      box(STEAM.copper, [0.27, 0.03, 0.19], [0, 0.72, -0.22]),
      box(STEAM.darkWood, [0.08, 0.16, 0.14], [-0.18, 0.5, 0.02])
    ]
  },
  {
    name: 'Lamplighter',
    parts: () => [
      ...person({ robe: STEAM.copper, coat: STEAM.cream, hair: STEAM.iron }),
      tube(STEAM.iron, [0.15, 0.15, 0.02], [0, 1.01, 0]),
      tube(STEAM.iron, [0.08, 0.09, 0.14], [0, 1.09, 0]),
      box(STEAM.brass, [0.025, 1.1, 0.025], [0.2, 0.6, 0.1]),
      ball(STEAM.lampGlow, 0.055, [0.2, 1.2, 0.1])
    ]
  },
  {
    name: 'Workshop Hound',
    parts: () => [
      ...quadruped({ coat: STEAM.floorWood, length: 0.5, girth: 0.2, leg: 0.24, head: 0.11 }),
      box(STEAM.floorWood, [0.08, 0.07, 0.12], [0, 0.47, 0.4]),
      box(STEAM.darkWood, [0.03, 0.1, 0.06], [-0.1, 0.5, 0.28]),
      box(STEAM.darkWood, [0.03, 0.1, 0.06], [0.1, 0.5, 0.28]),
      box(STEAM.brass, [0.21, 0.04, 0.04], [0, 0.44, 0.22]),
      box(STEAM.floorWood, [0.04, 0.18, 0.04], [0, 0.5, -0.25])
    ]
  }
]
