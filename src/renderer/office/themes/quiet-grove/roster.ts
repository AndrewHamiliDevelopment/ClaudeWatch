import { makeRoster } from '../roster'
import { GROVE_CAST } from './cast'

export const QUIET_GROVE_ID = 'quiet-grove'

const LEADS_PER_KIN = 5

// The provider picks the kin, the office bay the character within it.
export const quietGroveRoster = makeRoster(QUIET_GROVE_ID, GROVE_CAST, LEADS_PER_KIN)
