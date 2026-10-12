import { describe, vi } from 'vitest'
import { Texture } from 'three'
import { COURT_LOT_KIT } from './court-lots'
import { violetCourt } from './index'
import { describeWorldFill } from './world-fill.test-utils'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  useRef: (current: object) => ({ current })
}))
vi.mock('@react-three/fiber', () => import('./frame-capture.test-utils'))
vi.mock('../../scene/textures', () => ({
  signTexture: () => new Texture(),
  blobShadowTexture: () => new Texture()
}))

describe('Violet Court world fill', () => {
  describeWorldFill(violetCourt, COURT_LOT_KIT, ['ambient-banner', 'ambient-patrol'])
})
