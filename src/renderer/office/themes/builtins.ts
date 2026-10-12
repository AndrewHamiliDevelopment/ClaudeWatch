import { ROBOT_PALETTE } from '../office-palette'
import { BrassAmbient } from './BrassAmbient'
import { BrassFrame } from './BrassFrame'
import { BrassLounge } from './BrassLounge'
import { BrassSurroundings } from './BrassSurroundings'
import { EdoAmbient } from './EdoAmbient'
import { EdoLounge } from './EdoLounge'
import { EdoSurroundings } from './EdoSurroundings'
import * as brass from './BrassKit'
import { SamuraiFrame } from './SamuraiFrame'
import { EdoRoomFloors, EdoSlab } from './EdoFloor'
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
    floor: { Slab: EdoSlab, Elevator: EdoElevator },
    zone: {
      CompanyZone: EdoCompanyZone,
      ProjectOffice: EdoProjectOffice,
      RoomFloors: EdoRoomFloors,
      Walls: EdoWalls,
      Doorway: EdoDoorway,
      Desk: EdoDesk,
      RoomDressing: EdoRoomDressing,
      RoomSign: EdoRoomSign,
      Lounge: EdoLounge,
      Surroundings: EdoSurroundings,
      Ambient: EdoAmbient
    }
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
    floor: { Slab: brass.BrassSlab, Elevator: brass.BrassElevator },
    zone: {
      CompanyZone: BrassCompanyZone,
      ProjectOffice: BrassProjectOffice,
      RoomFloors: brass.BrassRoomFloors,
      Walls: brass.BrassWalls,
      Doorway: brass.BrassDoorway,
      Desk: brass.BrassDesk,
      RoomDressing: brass.BrassRoomDressing,
      RoomSign: brass.BrassRoomSign,
      Lounge: BrassLounge,
      Surroundings: BrassSurroundings,
      Ambient: BrassAmbient
    }
  },
  world: { District: brass.BrassDistrict, Hangar: brass.BrassHangar, Tower: brass.BrassTower }
}
