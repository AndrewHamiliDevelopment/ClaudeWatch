import { vi } from 'vitest'
import { describeLooks } from '../looks.test-utils'
import { GARRISON_CAST } from './cast'
import { CREW_PIVOT, crewParts } from './crew-parts'
import { garrisonLook, ORBITAL_GARRISON_ID } from './roster'

// Expand the model's JSX without a Canvas.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useRef: () => ({ current: null })
}))

describeLooks({
  themeId: ORBITAL_GARRISON_ID,
  cast: GARRISON_CAST,
  lookOf: garrisonLook,
  factionOf: (who) => who.section,
  isSquad: (who) => who.isSquad,
  // RobotEffects floats the thought dots at 1.2.
  figureOf: (who) => ({ joints: crewParts(who), headPivotY: CREW_PIVOT.head[1], thoughtY: 1.2 })
})
