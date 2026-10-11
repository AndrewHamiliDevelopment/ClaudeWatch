import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Ref } from 'react'
import { CameraRig } from './CameraRig'
import { makeAgent, makeFloor, makeZone } from '../__tests__/fixtures'

const { controls, surface } = vi.hoisted(() => ({
  controls: {
    mouseButtons: {},
    touches: {},
    azimuthAngle: 0,
    moveTo: vi.fn(),
    zoomTo: vi.fn(),
    rotateTo: vi.fn()
  },
  surface: {
    size: { width: 1200, height: 800 },
    gl: { domElement: document.createElement('canvas') }
  }
}))
vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: typeof surface) => object) => selector(surface)
}))
vi.mock('@react-three/drei', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    CameraControlsImpl: { ACTION: { TRUCK: 1, NONE: 0, TOUCH_TRUCK: 2 } },
    CameraControls: ({ ref }: { ref: Ref<typeof controls> }) => {
      useImperativeHandle(ref, () => controls)
      return null
    }
  }
})

it('preserves desk zoom when the viewport or project count changes', () => {
  const agent = makeAgent({ agentKey: 'a1' })
  const props = {
    floor: makeFloor({ floorId: 'f1' }),
    floorCount: 1,
    agents: [agent],
    liveSessionKeys: new Set<string>(),
    selectedAgentKey: agent.agentKey,
    isReducedMotion: true,
    onBandChange: vi.fn()
  }
  const { rerender } = render(
    <CameraRig {...props} request={{ kind: 'fly', agentKey: agent.agentKey, nonce: 1 }} />
  )
  expect(props.onBandChange).toHaveBeenLastCalledWith('desk')
  const calls = controls.zoomTo.mock.calls.length
  surface.size = { width: 800, height: 600 }
  rerender(<CameraRig {...props} floorCount={2} request={null} />)
  expect(props.onBandChange).toHaveBeenLastCalledWith('desk')
  expect(controls.zoomTo).toHaveBeenCalledTimes(calls)
})

const cornerFloor = makeFloor({
  floorId: 'one',
  width: 120,
  depth: 90,
  zones: [
    makeZone({
      id: 'c',
      kind: 'company',
      x: 40,
      z: 30,
      width: 30,
      depth: 20,
      children: [
        makeZone({
          id: 'p',
          kind: 'project',
          x: 45,
          z: 32,
          width: 12,
          depth: 8,
          children: [makeZone({ id: 'o', kind: 'office', sessionKey: 'claude:a', x: 45, z: 32 })]
        })
      ]
    })
  ]
})

function rigProps() {
  return {
    floor: cornerFloor,
    floorCount: 1,
    agents: [],
    liveSessionKeys: new Set(['claude:a']),
    selectedAgentKey: null,
    isReducedMotion: true,
    onBandChange: vi.fn(),
    request: null
  }
}

it('frames the occupied project office, not the plate centre, at the floor band', () => {
  controls.moveTo.mockClear()
  surface.size = { width: 1440, height: 900 }
  render(<CameraRig {...rigProps()} />)
  const [x, , z] = controls.moveTo.mock.calls.at(-1) ?? []
  expect(Math.hypot(Number(x) - 45, Number(z) - 32)).toBeLessThan(12)
})

it('flies to a company zone when asked', () => {
  const props = rigProps()
  const { rerender } = render(<CameraRig {...props} />)
  controls.moveTo.mockClear()
  rerender(<CameraRig {...props} request={{ kind: 'zone', zoneId: 'c', nonce: 2 }} />)
  expect(controls.moveTo).toHaveBeenCalled()
  expect(props.onBandChange).toHaveBeenLastCalledWith('floor')
})
