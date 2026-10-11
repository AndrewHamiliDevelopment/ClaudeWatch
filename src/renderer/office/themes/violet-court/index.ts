import { BrassRoomSign } from '../BrassKit'
import type { OfficeTheme } from '../types'
import { CourtCompanyZone, CourtElevator, CourtProjectOffice, CourtSlab } from './CourtGrounds'
import { CourtPilot } from './CourtPilot'
import { CourtDesk, CourtDoorway, CourtRoomDressing, CourtRoomFloors } from './CourtRoom'
import { CourtWalls } from './CourtWalls'
import { CourtDistrict, CourtHangar, CourtTower } from './CourtWorld'
import { COURT, COURT_PALETTE } from './palette'
import { VIOLET_COURT_ID } from './roster'

// dead-code-allowed: the cast and frames as { id, name, role } for the Office HUD 2026-12-31
export { COURT_FRAMES, violetCourtRoster } from './roster'

export const violetCourt: OfficeTheme = {
  id: VIOLET_COURT_ID,
  label: 'Violet Court',
  description: 'A royal court in violet, black and gold: pilots at their desks, knights parked.',
  palette: COURT_PALETTE,
  robot: {
    Model: CourtPilot,
    skins: {
      claude: { label: 'The Order', body: COURT.ink, trim: COURT.violet, eye: COURT.lumen },
      codex: { label: 'Lance Corps', body: COURT.ivory, trim: COURT.gold, eye: COURT.lumen }
    }
  },
  kit: {
    floor: { Slab: CourtSlab, Elevator: CourtElevator },
    zone: {
      CompanyZone: CourtCompanyZone,
      ProjectOffice: CourtProjectOffice,
      RoomFloors: CourtRoomFloors,
      Walls: CourtWalls,
      Doorway: CourtDoorway,
      Desk: CourtDesk,
      RoomDressing: CourtRoomDressing,
      // The door plaque is one shared textured sign in every theme.
      RoomSign: BrassRoomSign
    }
  },
  world: { District: CourtDistrict, Hangar: CourtHangar, Tower: CourtTower }
}
