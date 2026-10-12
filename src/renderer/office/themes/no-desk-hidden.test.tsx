import { describe, expect, it, vi } from 'vitest'
import { Texture } from 'three'
import { LIVE_FLOORS, OFF_CENTRE_FLOOR } from './floors.test-utils'
import { contains, grow, overlaps, type Rect } from './lot-math'
import { listThemes } from './registry'
import { apronOf } from './surroundings'
import { expectNoDeskHidden, themeBoxes, type DrawnBox } from './world-boxes.test-utils'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  useRef: (current: object) => ({ current })
}))
vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))
vi.mock('../scene/textures', () => ({
  signTexture: () => new Texture(),
  blobShadowTexture: () => new Texture()
}))

// Eaves, kerbs and plinths may overhang the footprint they stand on by this much.
const OVERHANG_M = 0.5
const THEMES = listThemes().map((theme) => [theme.label, theme] as const)

const isInside = (box: DrawnBox, rects: readonly Rect[]): boolean =>
  rects.some((rect) => contains(grow(rect, OVERHANG_M), box))

describe.each(THEMES)('%s', (_label, theme) => {
  it.each(LIVE_FLOORS)('hides no desk at any map rotation on %s', (_name, floor) => {
    const { district, surroundings, lounge } = themeBoxes(theme, floor)
    expect(district.length).toBeGreaterThan(0)
    expect(surroundings.length).toBeGreaterThan(0)
    expect(lounge.flat().length).toBeGreaterThan(0)
    expectNoDeskHidden(district, floor)
    expectNoDeskHidden(surroundings, floor)
    expectNoDeskHidden(lounge.flat(), floor)
  })

  it('draws round the real plate when its centre is at (20, -12)', () => {
    const floor = OFF_CENTRE_FLOOR
    const { lots, lounges, district, surroundings, lounge } = themeBoxes(theme, floor)
    const apron = apronOf(floor)
    for (const box of district) {
      expect(contains(grow(apron, OVERHANG_M), box), 'district part off the apron').toBe(true)
      expect(overlaps(box, grow(floor, -OVERHANG_M)), 'district part on the plate').toBe(false)
    }
    for (const box of surroundings)
      expect(isInside(box, lots), `surroundings part at ${box.x}, ${box.z} off its lot`).toBe(true)
    lounge.forEach((boxes, index) => {
      for (const box of boxes)
        expect(isInside(box, [lounges[index]]), 'lounge part outside its lounge').toBe(true)
    })
    expectNoDeskHidden([...district, ...surroundings, ...lounge.flat()], floor)
  })
})
