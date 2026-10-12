import type { TownDress } from '../../town/town-dress'
import { GARRISON } from './palette'

// One roof colour and one ground tint a zone: the zoning view, in the garrison's own colours.
export const GARRISON_LOOKS: TownDress['looks'] = {
  civic: { accent: GARRISON.ice, ground: '#2A3B55' },
  market: { accent: GARRISON.orange, ground: '#5A4230' },
  entertainment: { accent: '#B79CF0', ground: '#3D3558' },
  residential: { accent: GARRISON.white, ground: '#4A515C' },
  workshop: { accent: '#C9A227', ground: '#34383F' },
  park: { accent: '#7DB37A', ground: '#2F4A36' }
}

// A small figure is skin, cloth and hull: it stands out on the pale promenade, not on the deck.
export const GARRISON_ROADS: TownDress['roads'] = {
  carriageway: GARRISON.hull,
  sidewalk: '#5B6470',
  promenade: '#C9CED6'
}
