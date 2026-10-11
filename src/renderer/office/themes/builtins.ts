import { ROBOT_PALETTE } from '../office-palette'
import { BrassFrame } from './BrassFrame'
import * as brass from './BrassKit'
import { SamuraiFrame } from './SamuraiFrame'
import { EdoFloor } from './EdoFloor'
import { EdoWalls } from './EdoWalls'
import { EdoDesk, EdoDoorway, EdoElevator, EdoRoomDressing, EdoRoomSign } from './EdoRoom'
import { EdoDistrict, EdoTower } from './EdoDistrict'
import { EdoHangar } from './Hangar'
import { BRASS, EDO } from './palettes'
import { BrassCompanyZone, BrassProjectOffice, EdoCompanyZone, EdoProjectOffice } from './ZoneKits'
import type { OfficeTheme } from './types'

export const neoEdoSteam: OfficeTheme = {
  id: 'neo-edo-steam',
  label: 'Neo Edo Steam',
  description: 'A lantern-lit cedar atelier within a vast steam-powered pagoda district.',
  palette: EDO,
  robot: {
    Model: SamuraiFrame,
    skins: {
      claude: { label: 'Ivory Crescent', body: EDO.paper, trim: EDO.gold, eye: EDO.glow },
      codex: { label: 'Crimson Reed', body: EDO.lacquer, trim: '#C5CED2', eye: '#5FE3D3' }
    }
  },
  kit: {
    Floor: EdoFloor,
    Walls: EdoWalls,
    Doorway: EdoDoorway,
    Desk: EdoDesk,
    RoomDressing: EdoRoomDressing,
    Elevator: EdoElevator,
    RoomSign: EdoRoomSign,
    CompanyZone: EdoCompanyZone,
    ProjectOffice: EdoProjectOffice
  },
  world: { District: EdoDistrict, Hangar: EdoHangar, Tower: EdoTower }
}

export const brassWorkshop: OfficeTheme = {
  id: 'brass-workshop',
  label: 'Brass Workshop',
  description: 'The original brass hover automatons, copper archways and birdcage lift.',
  palette: BRASS,
  robot: {
    Model: BrassFrame,
    skins: {
      claude: { ...ROBOT_PALETTE.claude, label: 'Brass Warden' },
      codex: { ...ROBOT_PALETTE.codex, label: 'Copper Scout' }
    }
  },
  kit: {
    Floor: brass.BrassFloor,
    Walls: brass.BrassWalls,
    Doorway: brass.BrassDoorway,
    Desk: brass.BrassDesk,
    RoomDressing: brass.BrassRoomDressing,
    Elevator: brass.BrassElevator,
    RoomSign: brass.BrassRoomSign,
    CompanyZone: BrassCompanyZone,
    ProjectOffice: BrassProjectOffice
  },
  world: { District: brass.BrassDistrict, Hangar: brass.BrassHangar, Tower: brass.BrassTower }
}
