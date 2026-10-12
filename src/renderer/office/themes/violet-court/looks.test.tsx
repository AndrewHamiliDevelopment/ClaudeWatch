import { vi } from 'vitest'
import { describeLooks } from '../looks.test-utils'
import { COURT_CAST } from './cast'
import { PILOT_PIVOT, pilotParts } from './pilot-parts'
import { courtLook, VIOLET_COURT_ID } from './roster'

// Expand the model's JSX without a Canvas.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useRef: () => ({ current: null })
}))

describeLooks({
  themeId: VIOLET_COURT_ID,
  cast: COURT_CAST,
  lookOf: courtLook,
  factionOf: (who) => who.faction,
  isSquad: (who) => who.isSquad,
  // RobotEffects floats the thought dots at 1.2.
  figureOf: (who) => ({ joints: pilotParts(who), headPivotY: PILOT_PIVOT.head[1], thoughtY: 1.2 })
})
