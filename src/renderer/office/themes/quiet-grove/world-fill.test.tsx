import { describe, vi } from 'vitest'
import { Texture } from 'three'
import { describeWorldFill } from '../violet-court/world-fill.test-utils'
import { GROVE_LOT_KIT } from './grove-lots'
import { quietGrove } from './index'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  useRef: (current: object) => ({ current })
}))
vi.mock('@react-three/fiber', () => import('../violet-court/frame-capture.test-utils'))
vi.mock('../../scene/textures', () => ({
  signTexture: () => new Texture(),
  blobShadowTexture: () => new Texture()
}))

describe('Quiet Grove world fill', () => {
  describeWorldFill(quietGrove, GROVE_LOT_KIT, ['ambient-firefly', 'ambient-leaf'])
})
