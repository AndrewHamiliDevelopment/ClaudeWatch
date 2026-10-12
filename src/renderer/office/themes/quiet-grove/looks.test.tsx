import { vi } from 'vitest'
import { describeLooks } from '../looks.test-utils'
import { GROVE_CAST } from './cast'
import { groveLook, QUIET_GROVE_ID } from './roster'
import { spiritBuild } from './spirit-parts'

// Expand the model's JSX without a Canvas.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useRef: () => ({ current: null })
}))

describeLooks({
  themeId: QUIET_GROVE_ID,
  cast: GROVE_CAST,
  lookOf: groveLook,
  factionOf: (who) => who.kin,
  isSquad: (who) => who.isSprout,
  figureOf: (who) => {
    const build = spiritBuild(who)
    return { joints: build.joints, headPivotY: build.pivot.head[1], thoughtY: build.crown }
  }
})
