import { render } from '@testing-library/react'
import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { makeAgent, makeFloor, makeRoom, makeSession } from '../__tests__/fixtures'
import { officeSettings, type OfficeSettingKey } from '../logic/office-settings'
import { createPlayer } from '../player/walking'
import { pinQuality } from '../quality-store'
import { themeForTeam } from '../themes/registry'
import { sceneExtent } from '../themes/surroundings'
import OfficeScene from './OfficeScene'

// Each layer is stood in for by a marker, so what the scene mounts can be read off the page.
// The lights and the background are three.js elements, which the DOM cannot draw.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div>
      {Children.toArray(children).filter(
        (child) => isValidElement(child) && typeof child.type !== 'string'
      )}
    </div>
  )
}))
vi.mock('./BatchedScene', () => ({
  BatchedScene: ({ children }: { children?: ReactNode }) => <>{children}</>
}))
vi.mock('./Horizon', () => ({ Horizon: () => <i data-layer="ground" /> }))
vi.mock('./FloorView', () => ({ FloorView: () => <i data-layer="floor" /> }))
vi.mock('./Robot', () => ({
  RobotCrew: ({ agents }: { agents: readonly unknown[] }) => (
    <i data-layer="agents" data-count={agents.length} />
  )
}))
vi.mock('./WorldView', () => ({
  WorldView: () => <i data-layer="district" />,
  SurroundingsView: ({
    ambientShare,
    lots
  }: {
    ambientShare: number
    lots: readonly unknown[]
  }) => <i data-layer="surroundings" data-ambient-share={ambientShare} data-lots={lots.length} />
}))
vi.mock('./ZonePickers', () => ({ ZonePickers: () => <i data-layer="pickers" /> }))
vi.mock('./CardProjector', () => ({ CardProjector: () => <i data-layer="cards" /> }))
vi.mock('./NameCards', () => ({ NameCardLayer: () => null }))
vi.mock('./CameraRig', () => ({
  CameraRig: ({ scene }: { scene: object }) => (
    <i data-layer="camera" data-scene={JSON.stringify(scene)} />
  )
}))
vi.mock('./RenderLoop', () => ({
  FrameGovernor: () => <i data-layer="governor" />,
  MetricsProbe: () => <i data-layer="metrics" />
}))
vi.mock('../player/Streets', () => ({ Streets: () => <i data-layer="streets" /> }))
vi.mock('../player/PlayerLayer', () => ({ PlayerLayer: () => <i data-layer="player" /> }))
vi.mock('../citizens/CitizenLayer', () => ({
  CitizenLayer: ({ player }: { player: unknown }) => (
    <i data-layer="citizens" data-follows-player={Boolean(player)} />
  )
}))

const session = makeSession({ key: 'claude:a' })
const floor = makeFloor({
  floorId: 'f1',
  label: 'Main',
  rooms: [makeRoom({ id: 'r1', sessionKey: session.key })]
})
const agents = [makeAgent({ agentKey: session.key })]

beforeEach(() => {
  localStorage.clear()
  officeSettings.reset()
  pinQuality('full')
})

function mount(off: readonly OfficeSettingKey[] = []) {
  for (const key of off) officeSettings.set(key, false)
  const { container } = render(
    <OfficeScene
      theme={themeForTeam()}
      floors={[{ floorId: 'f1', label: 'Main', attentionCount: 0 }]}
      sessions={[session]}
      floor={floor}
      agents={agents}
      cards={[]}
      stacks={[]}
      selectedAgentKey={null}
      wallsMode="cutaway"
      cameraRequest={null}
      metrics={{ fps: 0, frameMs: 0, drawCalls: 0, triangles: 0 }}
      onSelectAgent={vi.fn()}
      onFlyToAgent={vi.fn()}
      onFlyToZone={vi.fn()}
      reviewableKeys={new Set()}
      onReview={vi.fn()}
      speakingAgentKey={null}
      player={createPlayer({ x: 0, z: 0 })}
    />
  )
  const layer = (name: string): HTMLElement | null =>
    container.querySelector(`[data-layer="${name}"]`)
  const layers = (): string[] =>
    [...container.querySelectorAll('[data-layer]')].map(
      (node) => node.getAttribute('data-layer') ?? ''
    )
  return { layer, layers }
}

const TOWN = ['streets', 'district', 'surroundings']
const ALWAYS = ['ground', 'floor', 'agents', 'pickers', 'cards', 'camera', 'governor', 'metrics']

it('mounts the whole living world while every switch is on', () => {
  const { layer, layers } = mount()
  expect(layers().sort()).toEqual([...ALWAYS, ...TOWN, 'citizens', 'player'].sort())
  expect(Number(layer('surroundings')?.dataset.ambientShare)).toBeGreaterThan(0)
  expect(Number(layer('surroundings')?.dataset.lots)).toBeGreaterThan(0)
})

it('takes the buildings, the district and the streets out when the town is off', () => {
  const { layer, layers } = mount(['town'])
  for (const name of TOWN) expect(layers()).not.toContain(name)
  // Framed on the floor alone: no ring of lots is left to make room for.
  expect(JSON.parse(layer('camera')?.dataset.scene ?? '{}')).toMatchObject(sceneExtent(floor, []))
  expect(layers()).toEqual(expect.arrayContaining([...ALWAYS, 'citizens', 'player']))
})

it('frames the ring of lots while the town is on', () => {
  const { layer } = mount()
  const framed = JSON.parse(layer('camera')?.dataset.scene ?? '{}')
  expect(framed.width).toBeGreaterThan(sceneExtent(floor, []).width)
})

it('mounts no ambient mover when ambient motion is off, and keeps the buildings', () => {
  const { layer } = mount(['ambient'])
  // A share of 0 is the surroundings' own "mount nothing ambient".
  expect(layer('surroundings')?.dataset.ambientShare).toBe('0')
  expect(Number(layer('surroundings')?.dataset.lots)).toBeGreaterThan(0)
})

it('does not mount the citizens layer when citizens are off', () => {
  const { layers } = mount(['citizens'])
  expect(layers()).not.toContain('citizens')
  expect(layers()).toEqual(expect.arrayContaining([...ALWAYS, ...TOWN, 'player']))
})

it('does not mount the player when it is off, and the citizens stop minding it', () => {
  const { layer, layers } = mount(['player'])
  expect(layers()).not.toContain('player')
  expect(layer('citizens')?.dataset.followsPlayer).toBe('false')
})

it('leaves the scene alone for the switches it does not draw', () => {
  const { layers } = mount(['vehicles', 'loungeTrips'])
  expect(layers().sort()).toEqual([...ALWAYS, ...TOWN, 'citizens', 'player'].sort())
})

it('is the compact floor with its agents and nothing else when everything is off', () => {
  const { layer, layers } = mount([
    'town',
    'citizens',
    'vehicles',
    'ambient',
    'loungeTrips',
    'player'
  ])
  expect(layers().sort()).toEqual([...ALWAYS].sort())
  expect(layer('agents')?.dataset.count).toBe('1')
  expect(JSON.parse(layer('camera')?.dataset.scene ?? '{}')).toMatchObject(sceneExtent(floor, []))
})

it('follows a switch flipped while the scene is on show', async () => {
  const { layers } = mount()
  const { act } = await import('@testing-library/react')
  act(() => officeSettings.set('citizens', false))
  expect(layers()).not.toContain('citizens')
  act(() => officeSettings.set('citizens', true))
  expect(layers()).toContain('citizens')
})
