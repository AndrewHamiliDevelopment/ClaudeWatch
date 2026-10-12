import type { SessionRef } from '../../shared/office/types'
import { LANE, packCompanies } from './allocation'
import { draftCompany, settleCompany } from './projects'
import type { FloorLayout } from './rooms'
export type { FloorLayout, LoungeLayout, RoomLayout, Slot, ZoneLayout } from './rooms'

export interface LayoutMap {
  version: 1
  floors: FloorLayout[]
  reservations: Record<
    string,
    { floorId: string; plate: number; bay: number; companyKey: string; projectKey: string }
  >
}

const EMPTY_FLOOR_SIDE = 12

// Only order and bays are read back from `saved`. Every size and position is rebuilt from the
// live sessions, so a map saved with larger numbers, or by an older shape, comes out compact.
export function buildLayout(
  sessions: SessionRef[],
  saved: LayoutMap | undefined,
  _nowMs: number
): LayoutMap {
  const ordered = [...sessions].sort(
    (a, b) =>
      a.companyKey.localeCompare(b.companyKey) ||
      a.projectKey.localeCompare(b.projectKey) ||
      a.key.localeCompare(b.key)
  )
  const drafts = [...new Set(ordered.map((s) => s.companyKey))].map((companyKey) =>
    draftCompany(
      ordered.filter((s) => s.companyKey === companyKey),
      saved
    )
  )
  const zones = drafts.map((draft) => draft.zone)
  packCompanies(zones)
  // The gate stays at the origin, the centre of the plate, so nothing moves when the floor
  // grows or shrinks: the plate is the smallest box around the companies that keeps it there.
  const side = (reach: number[]): number => 2 * Math.max(EMPTY_FLOOR_SIDE / 2, ...reach)
  return {
    version: 1,
    floors: [
      {
        id: 'hq',
        label:
          new Set(ordered.map((s) => s.projectKey)).size === 1
            ? ordered[0].projectLabel
            : 'Headquarters',
        width: side(zones.map((c) => Math.abs(c.x) + c.width / 2 + LANE)),
        depth: side(zones.map((c) => Math.abs(c.z) + c.depth / 2 + LANE)),
        rooms: drafts.flatMap((draft) => settleCompany(draft)),
        zones,
        elevator: { id: 'entrance', x: 0, z: 0, heading: 0 }
      }
    ],
    reservations: Object.fromEntries(drafts.flatMap((draft) => Object.entries(draft.reservations)))
  }
}
