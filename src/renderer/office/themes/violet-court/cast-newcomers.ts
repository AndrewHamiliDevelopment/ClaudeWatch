import { CORPS, GUILD, ORDER, type CourtCharacter } from './faction'
import { COURT } from './palette'

// Original characters, appended after the founding cast: three more of the Order, three more
// of the Corps, then the Herald Guild and its page.
export const COURT_NEWCOMERS: readonly CourtCharacter[] = [
  {
    ...ORDER,
    id: 'corvin-thrale',
    name: 'Corvin Thrale',
    role: 'Warden of the gate; holds the door of the Order behind a round shield.',
    jacket: COURT.ink,
    hair: COURT.ink,
    features: ['hood', 'shield']
  },
  {
    ...ORDER,
    id: 'maren-quill',
    name: 'Maren Quill',
    role: 'Cartographer; draws the board before the Order sets a single piece on it.',
    jacket: COURT.violet,
    trim: COURT.gold,
    hair: COURT.crimson,
    features: ['wide-hat', 'scroll-case']
  },
  {
    ...ORDER,
    id: 'dask-ferrow',
    name: 'Dask Ferrow',
    role: 'Night watch; walks the cloister with a lantern until the last desk is dark.',
    jacket: COURT.slate,
    hair: COURT.ivory,
    features: ['beret', 'lantern', 'staff']
  },
  {
    ...CORPS,
    id: 'isolde-wynn',
    name: 'Isolde Wynn',
    role: 'Physician of the Corps; patches up pilots and frames with the same calm.',
    jacket: COURT.ivory,
    hair: COURT.crimson,
    features: ['bun', 'satchel']
  },
  {
    ...CORPS,
    id: 'bertram-loxley',
    name: 'Bertram Loxley',
    role: 'Drill master; has every cadet marching in step before breakfast.',
    jacket: COURT.marble,
    trousers: COURT.slate,
    hair: COURT.ink,
    features: ['helmet', 'plume', 'cape']
  },
  {
    ...CORPS,
    id: 'cecily-farrow',
    name: 'Cecily Farrow',
    role: 'Signaller; sounds the horn that sends the lancers out and calls them home.',
    jacket: COURT.ivory,
    trim: COURT.violet,
    hair: COURT.ink,
    features: ['beret', 'horn']
  },
  {
    ...GUILD,
    id: 'hesper-clave',
    name: 'Hesper Clave',
    role: 'Guildmaster of the heralds; no word leaves the court without her seal.',
    hair: COURT.ivory,
    features: ['tabard', 'wide-hat', 'plume', 'cloak']
  },
  {
    ...GUILD,
    id: 'jory-tallis',
    name: 'Jory Tallis',
    role: 'Trumpeter; announces every arrival a little louder than is needed.',
    hair: COURT.gold,
    features: ['tabard', 'beret', 'horn']
  },
  {
    ...GUILD,
    id: 'anselm-greve',
    name: 'Anselm Greve',
    role: 'Courier; rides between the offices with a satchel that is never empty.',
    hair: COURT.ink,
    features: ['tabard', 'hood', 'satchel']
  },
  {
    ...GUILD,
    id: 'lysa-verran',
    name: 'Lysa Verran',
    role: 'Scribe; takes down what was said and what was meant, in two columns.',
    hair: COURT.ink,
    features: ['tabard', 'bun', 'tablet']
  },
  {
    ...GUILD,
    id: 'osric-penhale',
    name: 'Osric Penhale',
    role: 'Pursuivant; carries the guild shield and checks every crest against the rolls.',
    hair: COURT.ink,
    features: ['tabard', 'helmet', 'plume', 'shield']
  },
  {
    ...GUILD,
    id: 'fenna-dray',
    name: 'Fenna Dray',
    role: 'Lantern bearer; lights the way for a message that cannot wait for morning.',
    hair: COURT.gold,
    features: ['tabard', 'long-hair', 'lantern']
  },
  {
    ...GUILD,
    id: 'tully-marsh',
    name: 'Tully Marsh',
    role: 'Mapmaker; keeps the routes of the couriers rolled up in a case on his back.',
    hair: COURT.ivory,
    features: ['tabard', 'goggles', 'scroll-case']
  },
  {
    ...GUILD,
    id: 'rosalind-ashe',
    name: 'Rosalind Ashe',
    role: 'Staff bearer; walks ahead of the guild and raps the floor for silence.',
    hair: COURT.ink,
    features: ['tabard', 'ponytail', 'staff', 'epaulettes']
  },
  {
    ...GUILD,
    isSquad: true,
    id: 'guild-page',
    name: 'Guild Page',
    role: 'Squad member of the Guild; runs a delegated task for a herald.',
    hair: COURT.ink,
    features: ['tabard', 'beret']
  }
]
