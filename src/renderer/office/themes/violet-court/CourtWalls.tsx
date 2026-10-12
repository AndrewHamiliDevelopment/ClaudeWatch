import { BandedWalls, type WallBand } from '../BandedWalls'
import type { WallsProps } from '../types'
import { COURT } from './palette'

const GLASS = { centre: 0.58, share: 0.3 }
const RAIL_HEIGHT = 0.06

// Violet panels, a dark glass band and a gold rail along the top.
const BANDS: readonly WallBand[] = [
  {
    name: 'panel',
    color: COURT.violet,
    thickness: 0.14,
    span: (height) => ({ y: height / 2, scaleY: height })
  },
  {
    name: 'glass',
    color: COURT.ink,
    thickness: 0.17,
    span: (height) => ({ y: height * GLASS.centre, scaleY: height * GLASS.share })
  },
  {
    name: 'rail',
    color: COURT.gold,
    thickness: 0.2,
    span: (height) => ({ y: height, scaleY: RAIL_HEIGHT })
  }
]

export function CourtWalls(props: WallsProps) {
  return <BandedWalls bands={BANDS} {...props} />
}
