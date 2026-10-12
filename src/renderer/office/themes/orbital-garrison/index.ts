import { BrassRoomSign } from '../BrassKit'
import type { OfficeTheme } from '../types'
import { GarrisonAmbient } from './GarrisonAmbient'
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
import { GarrisonLounge, GarrisonSurroundings } from './GarrisonSurroundings'
import { GarrisonWalls } from './GarrisonWalls'
import { GarrisonDistrict, GarrisonHangar, GarrisonTower } from './GarrisonWorld'
import { GARRISON, GARRISON_PALETTE } from './palette'
import { ORBITAL_GARRISON_ID, orbitalGarrisonRoster } from './roster'

export const orbitalGarrison: OfficeTheme = {
  id: ORBITAL_GARRISON_ID,
  label: 'Orbital Garrison',
  description:
    'A hangar deck in gunmetal, white and hazard orange: crews at consoles, frames parked.',
  palette: GARRISON_PALETTE,
  roster: orbitalGarrisonRoster,
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
      RoomSign: BrassRoomSign,
      Lounge: GarrisonLounge,
      Surroundings: GarrisonSurroundings,
      Ambient: GarrisonAmbient
    }
  },
  world: { District: GarrisonDistrict, Hangar: GarrisonHangar, Tower: GarrisonTower }
}
