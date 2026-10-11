import { BandedWalls, type WallBand } from '../BandedWalls'
import type { WallsProps } from '../types'
import { GARRISON } from './palette'

// A white bulkhead, a dark kick plate and a hazard stripe.
const BANDS: readonly WallBand[] = [
  {
    name: 'bulkhead',
    color: GARRISON.white,
    thickness: 0.14,
    span: (height) => ({ y: height / 2, scaleY: height })
  },
  {
    name: 'kick',
    color: GARRISON.hull,
    thickness: 0.18,
    span: (height) => ({ y: height * 0.11, scaleY: height * 0.22 })
  },
  {
    name: 'stripe',
    color: GARRISON.orange,
    thickness: 0.17,
    span: (height) => ({ y: height * 0.82, scaleY: height * 0.1 })
  }
]

export function GarrisonWalls(props: WallsProps) {
  return <BandedWalls bands={BANDS} {...props} />
}
