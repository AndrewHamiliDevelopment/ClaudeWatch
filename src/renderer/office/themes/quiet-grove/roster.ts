import type { ProviderId } from '../../../../shared/office/types'
import { makeLooks, makeRoster } from '../roster'
import { GROVE_CAST } from './cast'
import { KIN_ACCENTS, type Kin } from './kin'

export const QUIET_GROVE_ID = 'quiet-grove'

const PROVIDER_OF: Record<Kin, ProviderId> = {
  keeper: 'claude',
  helper: 'codex',
  wanderer: 'opencode'
}

// The provider picks the kin; the agent's own key and its office bay the character in it.
export const quietGroveRoster = makeRoster(QUIET_GROVE_ID, GROVE_CAST, (who) => ({
  provider: PROVIDER_OF[who.kin],
  isSquad: who.isSprout
}))

export const groveLook = makeLooks(quietGroveRoster, GROVE_CAST, (who) => KIN_ACCENTS[who.kin])
