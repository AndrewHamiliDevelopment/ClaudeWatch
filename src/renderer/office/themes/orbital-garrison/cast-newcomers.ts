import { GARRISON } from './palette'
import { DECK, SIGNAL, WING, type GarrisonCharacter } from './section'

// Original characters, appended after the founding cast: three more of the wing, three more
// of the deck, then the Signal Corps and its rating.
export const GARRISON_NEWCOMERS: readonly GarrisonCharacter[] = [
  {
    ...WING,
    id: 'anneke-strand',
    name: 'Anneke Strand',
    role: 'Navigator; carries the charts rolled in a tube and knows every lane by heart.',
    headgear: GARRISON.navy,
    hair: GARRISON.umber,
    features: ['side-cap', 'chart-tube']
  },
  {
    ...WING,
    id: 'teo-marwick',
    name: 'Teo Marwick',
    role: 'Spacewalk specialist; goes outside on a thruster pack when a hull plate works loose.',
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    features: ['hood', 'jet-pack']
  },
  {
    ...WING,
    id: 'ines-halvard',
    name: 'Ines Halvard',
    role: 'Wing medic; meets every returning pilot at the ladder with a kit bag.',
    headgear: GARRISON.orange,
    hair: GARRISON.steel,
    features: ['beret', 'medic-bag']
  },
  {
    ...DECK,
    id: 'kofi-brandt',
    name: 'Kofi Brandt',
    role: 'Welder; seals a cracked plate with the mask down and a coil of cable on his back.',
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    features: ['weld-mask', 'cable-coil']
  },
  {
    ...DECK,
    id: 'marit-sool',
    name: 'Marit Sool',
    role: 'Cargo handler; moves every crate on the station and knows what is in each one.',
    headgear: GARRISON.navy,
    hair: GARRISON.white,
    features: ['visor-cap', 'crate']
  },
  {
    ...DECK,
    id: 'dov-tessler',
    name: 'Dov Tessler',
    role: 'Fire watch; stands by every refuelling with a hood up and an extinguisher ready.',
    hair: GARRISON.hull,
    features: ['hood', 'extinguisher']
  },
  {
    ...SIGNAL,
    id: 'sabine-okoro',
    name: 'Sabine Okoro',
    role: 'Signals officer; decides which message goes out first when every channel is busy.',
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    features: ['peaked-cap', 'shoulder-boards', 'tablet']
  },
  {
    ...SIGNAL,
    id: 'emre-castellan',
    name: 'Emre Castellan',
    role: 'Sensor operator; carries a dish on his back and listens to the dark all shift.',
    hair: GARRISON.hull,
    features: ['headset', 'dish-pack']
  },
  {
    ...SIGNAL,
    id: 'liang-sorensen',
    name: 'Liang Sorensen',
    role: 'Surveyor; sets up the tripod and measures the station to the last rivet.',
    headgear: GARRISON.white,
    hair: GARRISON.hull,
    features: ['visor-cap', 'tripod']
  },
  {
    ...SIGNAL,
    id: 'petra-nwosu',
    name: 'Petra Nwosu',
    role: 'Signaller; runs up the flag when the radios are down and the wing still has to land.',
    headgear: GARRISON.orange,
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    features: ['beret', 'signal-flag']
  },
  {
    ...SIGNAL,
    id: 'oskar-rehn',
    name: 'Oskar Rehn',
    role: 'Code clerk; reads a scrambled message faster than most people read a clear one.',
    hair: GARRISON.white,
    features: ['goggles', 'scarf', 'chart-tube']
  },
  {
    ...SIGNAL,
    id: 'yusra-delacroix',
    name: 'Yusra Delacroix',
    role: 'Lookout; sits the long watch at the outer rail with a hood up against the cold.',
    hair: GARRISON.hull,
    features: ['hood', 'antenna', 'bandolier']
  },
  {
    ...SIGNAL,
    id: 'calder-imai',
    name: 'Calder Imai',
    role: 'Line rigger; strings the cable between the masts and climbs to fix it in any weather.',
    hair: GARRISON.hull,
    features: ['side-cap', 'cable-coil']
  },
  {
    ...SIGNAL,
    id: 'noemi-arce',
    name: 'Noemi Arce',
    role: 'Relay runner; flies a message across the yard by thruster pack when it cannot wait.',
    headgear: GARRISON.white,
    hair: GARRISON.hull,
    features: ['flight-helmet', 'jet-pack']
  },
  {
    ...SIGNAL,
    isSquad: true,
    id: 'signal-rating',
    name: 'Signal Rating',
    role: 'Squad member of the Signal Corps; runs a delegated task for a signaller.',
    hair: GARRISON.hull,
    features: ['visor-cap']
  }
]
