import { BrassRoomSign } from '../BrassKit'
import type { OfficeTheme } from '../types'
import { GroveCompanyZone, GroveElevator, GroveProjectOffice, GroveSlab } from './GroveGrounds'
import { GroveDesk, GroveDoorway, GroveRoomDressing, GroveRoomFloors } from './GroveRoom'
import { GroveLounge } from './GroveLounge'
import { GroveSpirit } from './GroveSpirit'
import { GroveAmbient, GroveSurroundings } from './GroveSurroundings'
import { GroveWalls } from './GroveWalls'
import { GroveDistrict, GroveHangar, GroveTower } from './GroveWorld'
import { GROVE, GROVE_PALETTE } from './palette'
import { QUIET_GROVE_ID, quietGroveRoster } from './roster'

export const quietGrove: OfficeTheme = {
  id: QUIET_GROVE_ID,
  label: 'Quiet Grove',
  description: 'A studio in a forest clearing: timber desks, hedges for walls, paper lanterns.',
  palette: GROVE_PALETTE,
  roster: quietGroveRoster,
  robot: {
    Model: GroveSpirit,
    skins: {
      claude: { label: 'Keepers', body: GROVE.clay, trim: GROVE.paper, eye: GROVE.lumen },
      codex: { label: 'Helpers', body: GROVE.stone, trim: GROVE.pond, eye: GROVE.pond }
    }
  },
  kit: {
    floor: { Slab: GroveSlab, Elevator: GroveElevator },
    zone: {
      CompanyZone: GroveCompanyZone,
      ProjectOffice: GroveProjectOffice,
      RoomFloors: GroveRoomFloors,
      Walls: GroveWalls,
      Doorway: GroveDoorway,
      Desk: GroveDesk,
      RoomDressing: GroveRoomDressing,
      // The door plaque is one shared textured sign in every theme.
      RoomSign: BrassRoomSign,
      Lounge: GroveLounge,
      Surroundings: GroveSurroundings,
      Ambient: GroveAmbient
    }
  },
  world: { District: GroveDistrict, Hangar: GroveHangar, Tower: GroveTower }
}
