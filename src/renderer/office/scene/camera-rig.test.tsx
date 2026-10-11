import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Ref } from 'react'
import { CameraRig } from './CameraRig'
import { makeAgent, makeFloor, makeRoom, makeZone } from '../__tests__/fixtures'

const { controls, surface } = vi.hoisted(() => ({
  controls: {
    mouseButtons: {} as Record<string, number>,
    touches: {} as Record<string, number>,
    azimuthAngle: 0,
    moveTo: vi.fn(),
    zoomTo: vi.fn(),
    rotateTo: vi.fn(),
    getTarget: vi.fn((out: { x: number; y: number; z: number }) => {
      out.x = 100
      out.y = 0.6
      out.z = 50
      return out
    })
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
    CameraControlsImpl: {
      ACTION: { TRUCK: 1, NONE: 0, TOUCH_TRUCK: 2, ROTATE: 3, TOUCH_ROTATE: 4 }
    },
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

it('pans with left-drag and rotates with right-drag or two fingers', () => {
  render(<CameraRig {...rigProps()} />)
  expect(controls.mouseButtons.left).toBe(1)
  expect(controls.mouseButtons.right).toBe(3)
  expect(controls.touches.one).toBe(2)
  expect(controls.touches.two).toBe(4)
})

function deskProps(roomX: number, hasAgent = true) {
  const agent = makeAgent({ agentKey: 'a1', roomId: 'r1', x: roomX + 1, z: 3 })
  return {
    ...rigProps(),
    floor: makeFloor({ floorId: 'one', rooms: [makeRoom({ id: 'r1', x: roomX, z: 4 })] }),
    agents: hasAgent ? [agent] : [],
    liveSessionKeys: new Set<string>(),
    selectedAgentKey: 'a1',
    request: { kind: 'fly' as const, agentKey: 'a1', nonce: 7 }
  }
}

it('at desk zoom keeps the office in view when its room is re-packed, shifting from the current target', () => {
  const first = deskProps(10)
  const { rerender } = render(<CameraRig {...first} />)
  controls.moveTo.mockClear()
  // The app keeps the same request object between feed frames; only the floor and agents change.
  const stable = { onBandChange: first.onBandChange, request: first.request }
  rerender(<CameraRig {...deskProps(10)} {...stable} />)
  expect(controls.moveTo).not.toHaveBeenCalled()
  rerender(<CameraRig {...deskProps(16)} {...stable} />)
  // The room moved +6 m in x; the user's own pan (target 100, 50) is kept and shifted.
  expect(controls.moveTo).toHaveBeenLastCalledWith(106, 0.6, 50, false)
  expect(first.onBandChange).toHaveBeenLastCalledWith('desk')
})

it('returns to the floor band when the followed agent leaves', () => {
  const first = deskProps(10)
  const { rerender } = render(<CameraRig {...first} />)
  rerender(
    <CameraRig
      {...deskProps(10, false)}
      onBandChange={first.onBandChange}
      request={first.request}
    />
  )
  expect(first.onBandChange).toHaveBeenLastCalledWith('floor')
})
