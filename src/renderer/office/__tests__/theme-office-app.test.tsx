import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OfficeApp } from '../OfficeApp'
import { makeAgent, makeFloor, makeFrame } from './fixtures'
import type { OfficeFeed } from '../scene-model'
import type { OfficeTheme, TowerFloor } from '../themes/types'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => true }))
vi.mock('../scene/OfficeScene', () => ({
  default: ({
    theme,
    floors,
    onFocusFloor
  }: {
    theme: OfficeTheme
    floors: TowerFloor[]
    onFocusFloor: (floorId: string) => void
  }) => (
    <div aria-label={`Scene theme ${theme.label}`}>
      {floors.map((floor) => (
        <button key={floor.floorId} onClick={() => onFocusFloor(floor.floorId)}>
          Storey {floor.label}: {floor.agentCount} agents, {floor.attentionCount} waiting
        </button>
      ))}
    </div>
  )
}))

const frame = makeFrame({
  floors: [
    makeFloor({ floorId: 'a', label: 'Atelier' }),
    makeFloor({ floorId: 'b', label: 'Forge' })
  ],
  agents: [
    makeAgent({ agentKey: 'a1', floorId: 'a' }),
    makeAgent({ agentKey: 'b1', floorId: 'b', attention: 'permission' })
  ]
})
const feed: OfficeFeed = {
  subscribe: (listener) => {
    listener(frame)
    return () => undefined
  },
  jump: vi.fn(),
  send: vi.fn(),
  respond: vi.fn(),
  peek: vi.fn(),
  start: vi.fn()
}
beforeEach(() => localStorage.clear())

it('passes theme selection and project counts to the live scene and focuses from the tower callback', async () => {
  render(<OfficeApp feed={feed} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Storey Forge: 1 agents, 1 waiting' }))
  expect(screen.getByRole('button', { name: /floor 2, Forge/i })).toHaveAttribute(
    'aria-current',
    'true'
  )
  fireEvent.click(screen.getByRole('button', { name: /Theme: Neo Edo Steam/ }))
  expect(screen.getByLabelText('Scene theme Brass Workshop')).toBeInTheDocument()
  expect(localStorage.getItem('claudewatch.office.theme')).toBe('brass-workshop')
  fireEvent.keyDown(window, { key: 't' })
  expect(screen.getByLabelText('Scene theme Neo Edo Steam')).toBeInTheDocument()
})
