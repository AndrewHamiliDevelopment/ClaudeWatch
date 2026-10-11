import { BrassRoomSign } from '../BrassKit'
import type { OfficeTheme } from '../types'
import { GarrisonCrew } from './GarrisonCrew'
import {
  GarrisonCompanyZone,
  GarrisonElevator,
  GarrisonProjectOffice,
  GarrisonSlab
} from './GarrisonGrounds'
import {
  GarrisonDesk,
  GarrisonDoorway,
  GarrisonRoomDressing,
  GarrisonRoomFloors
} from './GarrisonRoom'
import { GarrisonWalls } from './GarrisonWalls'
import { GarrisonDistrict, GarrisonHangar, GarrisonTower } from './GarrisonWorld'
import { GARRISON, GARRISON_PALETTE } from './palette'
import { ORBITAL_GARRISON_ID } from './roster'

// dead-code-allowed: the cast and frames as { id, name, role } for the Office HUD 2026-12-31
export { GARRISON_FRAMES, orbitalGarrisonRoster } from './roster'

export const orbitalGarrison: OfficeTheme = {
  id: ORBITAL_GARRISON_ID,
  label: 'Orbital Garrison',
  description:
    'A hangar deck in gunmetal, white and hazard orange: crews at consoles, frames parked.',
  palette: GARRISON_PALETTE,
  robot: {
    Model: GarrisonCrew,
    skins: {
      claude: {
        label: 'Flight Wing',
        body: GARRISON.white,
        trim: GARRISON.orange,
        eye: GARRISON.ice
      },
      codex: {
        label: 'Deck Crew',
        body: GARRISON.orange,
        trim: GARRISON.white,
        eye: GARRISON.ice
      }
    }
  },
  kit: {
    floor: { Slab: GarrisonSlab, Elevator: GarrisonElevator },
    zone: {
      CompanyZone: GarrisonCompanyZone,
      ProjectOffice: GarrisonProjectOffice,
      RoomFloors: GarrisonRoomFloors,
      Walls: GarrisonWalls,
      Doorway: GarrisonDoorway,
      Desk: GarrisonDesk,
      RoomDressing: GarrisonRoomDressing,
      // The door plaque is one shared textured sign in every theme.
      RoomSign: BrassRoomSign
    }
  },
  world: { District: GarrisonDistrict, Hangar: GarrisonHangar, Tower: GarrisonTower }
}
