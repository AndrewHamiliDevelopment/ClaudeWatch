import { describe, it, expect } from 'vitest'
import { buildLayout } from '../../office/sim/layout'
import { toFloorGeometry, toSceneAgent } from './layout-geometry'
import type { AgentView, SessionRef } from '../../shared/office/types'

const session = (
  key: string,
  projectKey: string,
  overrides: Partial<SessionRef> = {}
): SessionRef => ({
  key,
  provider: 'claude',
  sessionId: key,
  pid: 1,
  name: `session ${key}`,
  cwd: '/repo',
  projectKey,
  projectLabel: projectKey === 'p_a' ? 'Alpha' : 'Beta',
  projectRoot: '/repo/app',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
  worktree: null,
  host: 'terminal',
  orcaPaneKey: null,
  activity: 'idle',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: 1,
  updatedAtMs: 1,
  ...overrides
})

describe('toFloorGeometry', () => {
  const sessions = [
    session('claude:1', 'p_a'),
    session('claude:2', 'p_a'),
    session('claude:3', 'p_b')
  ]
  const layout = buildLayout(sessions, undefined, 0)
  const floors = toFloorGeometry(layout, sessions)

  it('makes one floor per project, labelled with the project name', () => {
    expect(floors.map((f) => [f.floorId, f.label, f.plate])).toEqual([
      ['p_a', 'Alpha', 0],
      ['p_b', 'Beta', 0]
    ])
  })

  it('centres a 48 x 13.5 m plate on the origin with a 1.5 m corridor', () => {
    expect(floors[0]).toMatchObject({ width: 48, depth: 13.5, corridor: { z: 0, width: 1.5 } })
  })

  it('places each session room as a 6 x 6 m bay labelled with the session name', () => {
    const room = floors[0].rooms.find((r) => r.sessionKey === 'claude:1')
    expect(room).toMatchObject({ width: 6, depth: 6, kind: 'office', label: 'session claude:1' })
    expect(Math.abs(room!.z)).toBe(3.75)
    expect(Math.abs(room!.door.z)).toBe(0.75)
    expect(room!.x).toBeGreaterThanOrEqual(-21)
    expect(room!.x).toBeLessThanOrEqual(21)
  })
})

describe('toSceneAgent', () => {
  it('shifts sim coordinates into the centred floor frame', () => {
    const view: AgentView = {
      agentKey: 'claude:1',
      floorId: 'p_a',
      roomId: 'p_a:0:0',
      slotId: 'desk_main',
      x: 3,
      z: 3.75,
      heading: 0,
      activity: 'editing',
      attention: 'none',
      provider: 'claude',
      isSubagent: false,
      label: 'a'
    }
    expect(toSceneAgent(view)).toMatchObject({ x: -21, z: 3.75, floorId: 'p_a' })
  })
})
