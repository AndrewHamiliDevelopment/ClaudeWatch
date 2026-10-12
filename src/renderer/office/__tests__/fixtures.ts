import type { AgentView, SessionRef } from '../../../shared/office/types'
import type { FloorGeometry, OfficeFrame, RoomGeometry, ZoneGeometry } from '../scene-model'

export function makeSession(overrides: Partial<SessionRef> & Pick<SessionRef, 'key'>): SessionRef {
  return {
    provider: 'claude',
    sessionId: overrides.key.split(':')[1] ?? overrides.key,
    pid: 100,
    name: overrides.key,
    cwd: '/tmp/project',
    projectKey: 'p_1',
    projectLabel: 'Project',
    projectRoot: '/repo/app',
    companyKey: 'c_test',
    companyLabel: 'Test Co',
    worktree: null,
    host: 'terminal',
    // The bridge names a pane for every session it places in Orca, bar one that lost a contest.
    orcaPaneKey: overrides.host === 'orca' ? 'tab-1:leaf-1' : null,
    activity: 'idle',
    attention: 'none',
    currentTool: null,
    subagents: [],
    startedAtMs: 0,
    updatedAtMs: 0,
    ...overrides
  }
}

export function makeRoom(
  overrides: Partial<RoomGeometry> & Pick<RoomGeometry, 'id'>
): RoomGeometry {
  return {
    sessionKey: null,
    x: 0,
    z: -4,
    width: 6,
    depth: 5,
    door: { x: 0, z: -1.5 },
    label: overrides.id,
    kind: 'office',
    seats: [{ slotId: 'desk_main', x: 0, z: -3.7, heading: 0 }],
    ...overrides
  }
}

export function makeFloor(
  overrides: Partial<FloorGeometry> & Pick<FloorGeometry, 'floorId'>
): FloorGeometry {
  return {
    label: overrides.floorId,
    plate: 1,
    x: 0,
    z: 0,
    width: 20,
    depth: 16,
    corridor: { z: 0, width: 3 },
    rooms: [],
    zones: [],
    elevator: { x: -8, z: 0 },
    ...overrides
  }
}

export function makeZone(
  overrides: Partial<ZoneGeometry> & Pick<ZoneGeometry, 'id' | 'kind'>
): ZoneGeometry {
  return {
    label: overrides.id,
    x: 0,
    z: 0,
    width: 6,
    depth: 5,
    door: null,
    companyKey: null,
    projectKey: null,
    sessionKey: null,
    children: [],
    ...overrides
  }
}

export function makeAgent(overrides: Partial<AgentView> & Pick<AgentView, 'agentKey'>): AgentView {
  return {
    floorId: 'f1',
    roomId: 'r1',
    slotId: 'desk-0',
    x: 0,
    z: 0,
    heading: 0,
    activity: 'idle',
    attention: 'none',
    provider: 'claude',
    isSubagent: false,
    label: overrides.agentKey,
    ...overrides
  }
}

export function makeFrame(overrides: Partial<OfficeFrame> = {}): OfficeFrame {
  return { floors: [], agents: [], sessions: [], connected: true, sources: [], ...overrides }
}
