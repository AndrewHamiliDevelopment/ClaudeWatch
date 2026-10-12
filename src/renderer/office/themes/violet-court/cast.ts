import { COURT_NEWCOMERS } from './cast-newcomers'
import { CORPS, ORDER, type CourtCharacter } from './faction'
import { COURT } from './palette'

// The founding cast: five of the Order, five of the Lance Corps, then one squad member each.
const FOUNDERS: readonly CourtCharacter[] = [
  {
    ...ORDER,
    id: 'aurel-vane',
    name: 'Aurel Vane',
    role: 'Masked Regent of the Order; plans every move before the board is set.',
    jacket: COURT.ink,
    hair: COURT.ink,
    features: ['mask', 'high-collar', 'cloak']
  },
  {
    ...ORDER,
    id: 'sable-rooke',
    name: 'Sable Rooke',
    role: 'Ace of the Order; takes the close-combat frame to the front of every charge.',
    jacket: COURT.crimson,
    trim: COURT.gold,
    hair: COURT.ink,
    features: ['ponytail', 'blades']
  },
  {
    ...ORDER,
    id: 'ilse-marrow',
    name: 'Ilse Marrow',
    role: 'Archivist; keeps the record of the Order and reads the field reports.',
    jacket: COURT.violet,
    trim: COURT.gold,
    hair: COURT.ivory,
    features: ['long-hair', 'tablet']
  },
  {
    ...ORDER,
    id: 'tobin-cask',
    name: 'Tobin Cask',
    role: 'Engineer; keeps the knight frames running between sorties.',
    jacket: COURT.slate,
    trim: COURT.gold,
    hair: COURT.gold,
    features: ['goggles', 'pack']
  },
  {
    ...ORDER,
    id: 'wren-halloway',
    name: 'Wren Halloway',
    role: 'Herald; carries the banner of the Order and its messages.',
    jacket: COURT.ink,
    hair: COURT.crimson,
    features: ['banner', 'epaulettes']
  },
  {
    ...CORPS,
    id: 'odette-vey',
    name: 'Odette Vey',
    role: 'Marshal of the Lance Corps; commands the line from the command frame.',
    jacket: COURT.ivory,
    hair: COURT.ink,
    features: ['cap', 'high-collar', 'cloak', 'epaulettes']
  },
  {
    ...CORPS,
    id: 'garrick-hobb',
    name: 'Garrick Hobb',
    role: 'Quartermaster; arms and supplies every knight of the Corps.',
    jacket: COURT.marble,
    trousers: COURT.slate,
    hair: COURT.crimson,
    features: ['goggles', 'pack']
  },
  {
    ...CORPS,
    id: 'lucan-albright',
    name: 'Lucan Albright',
    role: 'White Lancer; knight ace of the Corps and rival of the Regent.',
    jacket: COURT.ivory,
    hair: COURT.gold,
    features: ['cape', 'epaulettes']
  },
  {
    ...CORPS,
    id: 'mirelle-dane',
    name: 'Mirelle Dane',
    role: 'Envoy; speaks for the court and reads the room before anyone else.',
    jacket: COURT.ivory,
    trim: COURT.violet,
    hair: COURT.gold,
    features: ['long-hair', 'tablet']
  },
  {
    ...CORPS,
    id: 'tamsin-roe',
    name: 'Tamsin Roe',
    role: 'Standard-bearer; carries the colours of the Corps into the field.',
    jacket: COURT.ivory,
    hair: COURT.ink,
    features: ['ponytail', 'banner']
  },
  {
    ...ORDER,
    isSquad: true,
    id: 'violet-squire',
    name: 'Violet Squire',
    role: 'Squad member of the Order; runs a delegated task for a pilot.',
    jacket: COURT.violet,
    hair: COURT.ink,
    features: ['helmet']
  },
  {
    ...CORPS,
    isSquad: true,
    id: 'lance-cadet',
    name: 'Lance Cadet',
    role: 'Squad member of the Corps; runs a delegated task for a pilot.',
    jacket: COURT.marble,
    trousers: COURT.slate,
    hair: COURT.ink,
    features: ['helmet']
  }
]

// The order local renames are stored in: never reorder, only append.
export const COURT_CAST: readonly CourtCharacter[] = [...FOUNDERS, ...COURT_NEWCOMERS]
