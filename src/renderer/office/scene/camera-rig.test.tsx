import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Ref } from 'react'
import { CameraRig } from './CameraRig'
import { makeAgent, makeFloor } from '../__tests__/fixtures'

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
