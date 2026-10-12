import type { ApronPlan, ApronRow } from './apron'
import { GROUND_Y } from './surroundings'

// The paved band Neo Edo and Brass lay round the plate, and where their lots stand.
export const APRON_PAVING = { y: GROUND_Y + 0.15, thickness: 0.2 }
export const APRON_TOP_Y = APRON_PAVING.y + APRON_PAVING.thickness / 2

const exactly = (metres: number) => ({ min: metres, max: metres })

const GARDEN: ApronRow = {
  kind: 'prop',
  out: 2.1,
  along: exactly(1.8),
  across: exactly(1),
  pitch: 3.6,
  reach: 'plate'
}

const block = (out: number, across: number, along = 5.5, pitch = 7): ApronRow => ({
  kind: 'building',
  out,
  along: exactly(along),
  across: exactly(across),
  pitch,
  reach: 'plate'
})

const throughCorners = (row: ApronRow): ApronRow => ({ ...row, reach: 'apron' })

// A garden row against the plate, then town blocks; the north and south rows take the corners.
export const TOWN_APRON: ApronPlan = {
  north: [GARDEN, block(6.95, 5.5), block(14.7, 7, 6.5, 8)].map(throughCorners),
  south: [GARDEN, block(5.6, 4)].map(throughCorners),
  west: [GARDEN, block(7.45, 6.5)],
  east: [GARDEN, block(7.45, 6.5)]
}
