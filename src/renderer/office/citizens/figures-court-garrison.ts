import { GARRISON } from '../themes/orbital-garrison/palette'
import { COURT } from '../themes/violet-court/palette'
import { ball, box, person, tube, type CitizenFigure } from './figure-parts'

// Violet Court: the academy's own, out between lessons.
export const COURT_CITIZENS: readonly CitizenFigure[] = [
  {
    name: 'Court Student',
    parts: () => [
      ...person({ robe: COURT.ivory, coat: COURT.violet, hair: COURT.gold }),
      box(COURT.crimson, [0.28, 0.3, 0.03], [0, 0.63, -0.15]),
      box(COURT.gold, [0.06, 0.12, 0.03], [0, 0.7, 0.15]),
      box(COURT.lumen, [0.12, 0.16, 0.05], [0.18, 0.58, 0.12])
    ]
  },
  {
    name: 'Banner-bearer',
    parts: () => [
      ...person({ robe: COURT.crimson, coat: COURT.gold, hair: COURT.ink }),
      box(COURT.gold, [0.025, 1.22, 0.025], [0.2, 0.61, 0]),
      box(COURT.lumen, [0.02, 0.42, 0.26], [0.2, 0.99, -0.14]),
      box(COURT.gold, [0.022, 0.06, 0.26], [0.2, 0.8, -0.14])
    ]
  },
  {
    name: 'Gowned Scholar',
    parts: () => [
      tube(COURT.marble, [0.13, 0.22, 0.78], [0, 0.39, 0]),
      box(COURT.violet, [0.1, 0.5, 0.03], [0, 0.5, 0.19]),
      ball(COURT.skin, 0.11, [0, 0.9, 0]),
      box(COURT.violet, [0.28, 0.025, 0.28], [0, 1.02, 0]),
      box(COURT.gold, [0.03, 0.1, 0.03], [0.13, 0.97, 0.13]),
      tube(COURT.ivory, [0.035, 0.035, 0.26], [-0.17, 0.6, 0.08])
    ]
  },
  {
    name: 'Garden Heron',
    parts: () => [
      box(COURT.gold, [0.018, 0.4, 0.018], [-0.04, 0.2, 0]),
      box(COURT.gold, [0.018, 0.4, 0.018], [0.04, 0.2, 0]),
      ball(COURT.ivory, 0.14, [0, 0.48, -0.02]),
      box(COURT.lumen, [0.16, 0.06, 0.2], [0, 0.5, -0.16]),
      box(COURT.ivory, [0.045, 0.32, 0.045], [0, 0.7, 0.09]),
      ball(COURT.ivory, 0.06, [0, 0.88, 0.11]),
      box(COURT.gold, [0.02, 0.02, 0.16], [0, 0.87, 0.23]),
      box(COURT.violet, [0.02, 0.02, 0.12], [0, 0.93, 0.04])
    ]
  }
]

// Orbital Garrison: the people who work the apron between launches.
export const GARRISON_CITIZENS: readonly CitizenFigure[] = [
  {
    name: 'Deck Marshal',
    parts: () => [
      ...person({ robe: GARRISON.steel, coat: GARRISON.orange, hair: GARRISON.hull }),
      box(GARRISON.white, [0.31, 0.04, 0.3], [0, 0.66, 0]),
      box(GARRISON.hull, [0.27, 0.07, 0.07], [0, 0.92, 0]),
      box(GARRISON.ice, [0.035, 0.26, 0.035], [-0.23, 0.76, 0.08]),
      box(GARRISON.ice, [0.035, 0.26, 0.035], [0.23, 0.76, 0.08])
    ]
  },
  {
    name: 'Cart Hand',
    parts: () => [
      ...person({ robe: GARRISON.umber, coat: GARRISON.steel, hair: GARRISON.orange }),
      box(GARRISON.white, [0.42, 0.04, 0.5], [0, 0.15, 0.5]),
      box(GARRISON.hull, [0.05, 0.13, 0.13], [-0.2, 0.065, 0.5]),
      box(GARRISON.hull, [0.05, 0.13, 0.13], [0.2, 0.065, 0.5]),
      box(GARRISON.ice, [0.32, 0.24, 0.32], [0, 0.29, 0.54]),
      box(GARRISON.orange, [0.2, 0.14, 0.2], [0, 0.48, 0.56]),
      box(GARRISON.hull, [0.36, 0.03, 0.03], [0, 0.56, 0.24]),
      box(GARRISON.hull, [0.03, 0.42, 0.03], [-0.17, 0.36, 0.25]),
      box(GARRISON.hull, [0.03, 0.42, 0.03], [0.17, 0.36, 0.25])
    ]
  },
  {
    name: 'Off-duty Cadet',
    parts: () => [
      ...person({ robe: GARRISON.ice, coat: GARRISON.white, hair: GARRISON.umber }),
      box(GARRISON.navy, [0.2, 0.05, 0.1], [0, 1.02, 0]),
      box(GARRISON.umber, [0.16, 0.16, 0.42], [0.04, 0.72, -0.2]),
      box(GARRISON.hull, [0.04, 0.3, 0.03], [0.04, 0.68, 0.15])
    ]
  },
  {
    name: 'Mess Cook',
    parts: () => [
      ...person({ robe: GARRISON.steel, coat: GARRISON.white, hair: GARRISON.white }),
      tube(GARRISON.white, [0.11, 0.09, 0.18], [0, 1.09, 0]),
      box(GARRISON.gunmetal, [0.34, 0.02, 0.22], [0, 0.7, 0.24]),
      tube(GARRISON.orange, [0.07, 0.05, 0.07], [-0.08, 0.745, 0.24]),
      ball(GARRISON.ice, 0.05, [0.09, 0.75, 0.24])
    ]
  }
]
