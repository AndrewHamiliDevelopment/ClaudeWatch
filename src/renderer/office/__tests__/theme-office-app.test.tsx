import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OfficeApp } from '../OfficeApp'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession, makeZone } from './fixtures'
import type { OfficeFeed } from '../scene-model'
import { listThemes } from '../themes/registry'
import type { OfficeTheme, TowerFloor } from '../themes/types'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => true }))
vi.mock('../scene/OfficeScene', () => ({
  default: ({
    theme,
    floors,
    onFlyToZone
  }: {
    theme: OfficeTheme
    floors: TowerFloor[]
    onFlyToZone: (zoneId: string) => void
  }) => (
    <div aria-label={`Scene theme ${theme.label}`}>
      {floors.map((floor) => (
        <span key={floor.floorId}>
          Building {floor.label}: {floor.agentCount} agents, {floor.attentionCount} waiting
        </span>
      ))}
      <button onClick={() => onFlyToZone('p-forge')}>Double-click Forge</button>
    </div>
  )
}))

const frame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'one',
      label: 'Office',
      rooms: [makeRoom({ id: 'r1', sessionKey: 'claude:b' })],
      zones: [
        makeZone({
          id: 'c-guild',
          kind: 'company',
          label: 'Guild',
          companyKey: 'c_test',
          children: [
            makeZone({ id: 'p-forge', kind: 'project', label: 'Forge', projectKey: 'p_1' })
          ]
        })
      ]
    })
  ],
  sessions: [makeSession({ key: 'claude:b', attention: 'permission' })],
  agents: [makeAgent({ agentKey: 'b1', floorId: 'one', roomId: 'r1', attention: 'permission' })]
})
const feed: OfficeFeed = {
  subscribe: (listener) => {
    listener(frame)
    return () => undefined
  },
  focus: vi.fn().mockResolvedValue({ success: true }),
  send: vi.fn(),
  respond: vi.fn(),
  peek: vi.fn(),
  start: vi.fn()
}
beforeEach(() => localStorage.clear())

it('passes theme selection and building totals to the scene and flies to zones from it', async () => {
  render(<OfficeApp feed={feed} />)
  expect(await screen.findByText('Building Office: 1 agents, 1 waiting')).toBeInTheDocument()
  // The bar's button opens the themes list; it changes no theme by itself.
  fireEvent.click(screen.getByRole('button', { name: /^Floor theme: Neo Edo Steam/ }))
  expect(screen.getByLabelText('Scene theme Neo Edo Steam')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 't' })
  expect(screen.getByLabelText('Scene theme Brass Workshop')).toBeInTheDocument()
  expect(localStorage.getItem('claudewatch.office.theme')).toBe('brass-workshop')
  // T walks the rest of the registry and wraps back to the first theme.
  for (let press = 2; press <= listThemes().length; press++) fireEvent.keyDown(window, { key: 't' })
  expect(screen.getByLabelText('Scene theme Neo Edo Steam')).toBeInTheDocument()
  // Once a zone is focused T changes that office, says so, and the floor's theme stays put.
  fireEvent.click(screen.getByRole('button', { name: 'Double-click Forge' }))
  expect(screen.getByRole('button', { name: /^Forge, 1 agent/ })).toHaveAttribute(
    'aria-current',
    'true'
  )
  fireEvent.keyDown(window, { key: 't' })
  expect(
    screen.getByText('Forge office is now Brass Workshop. Other offices keep their themes.')
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Floor theme: Neo Edo Steam/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Scene theme Neo Edo Steam')).toBeInTheDocument()
})

it('gives the app window a strip to drag it by, with the panels below it', () => {
  const { container } = render(<OfficeApp feed={feed} hasHiddenTitleBar />)
  const strip = container.querySelector('.drag-region')
  expect(strip).not.toBeNull()
  // The strip sits under the HUD in the DOM order's stacking, and no panel may overlap it.
  expect(strip?.nextElementSibling?.className).toContain('pt-10')
})

it('leaves a browser tab without a drag strip', () => {
  const { container } = render(<OfficeApp feed={feed} />)
  expect(container.querySelector('.drag-region')).toBeNull()
})
