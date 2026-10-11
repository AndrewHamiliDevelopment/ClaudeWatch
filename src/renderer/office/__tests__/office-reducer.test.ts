import { describe, expect, it } from 'vitest'
import { INITIAL_OFFICE_STATE, officeReducer, type OfficeState } from '../logic/office-reducer'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from './fixtures'

const frame = makeFrame({
  floors: [
    makeFloor({ floorId: 'f1', rooms: [makeRoom({ id: 'r1', sessionKey: 'claude:a' })] }),
    makeFloor({
      floorId: 'f2',
      rooms: [
        makeRoom({ id: 'r2', sessionKey: 'claude:b' }),
        makeRoom({ id: 'r3', sessionKey: 'codex:c' })
      ]
    })
  ],
  sessions: [
    makeSession({ key: 'claude:a' }),
    makeSession({ key: 'claude:b', attention: 'permission', updatedAtMs: 10 }),
    makeSession({ key: 'codex:c', attention: 'question', updatedAtMs: 20 })
  ],
  agents: [
    makeAgent({ agentKey: 'a', floorId: 'f1', roomId: 'r1' }),
    makeAgent({ agentKey: 'b', floorId: 'f2', roomId: 'r2', attention: 'permission' }),
    makeAgent({ agentKey: 'b-sub', floorId: 'f2', roomId: 'r2', isSubagent: true }),
    makeAgent({ agentKey: 'c', floorId: 'f2', roomId: 'r3', attention: 'question' })
  ]
})

function withFrame(): OfficeState {
  return officeReducer(INITIAL_OFFICE_STATE, { type: 'frame-received', frame })
}

describe('officeReducer', () => {
  it('focuses the floor at the head of the attention queue on first frame', () => {
    expect(withFrame().focusedFloorId).toBe('f2')
  })

  it('opens a queued session: focuses its floor, selects its main agent and flies', () => {
    const state = officeReducer(
      { ...withFrame(), focusedFloorId: 'f1' },
      { type: 'session-opened', sessionKey: 'codex:c' }
    )
    expect(state.focusedFloorId).toBe('f2')
    expect(state.selectedAgentKey).toBe('c')
    expect(state.cameraRequest).toMatchObject({ kind: 'fly', agentKey: 'c' })
  })

  it('walks the queue with Next', () => {
    const first = officeReducer(withFrame(), { type: 'next-attention' })
    expect(first.selectedAgentKey).toBe('b')
    const second = officeReducer(first, { type: 'next-attention' })
    expect(second.selectedAgentKey).toBe('c')
  })

  it('changes floor by step and by number, clamped to the building', () => {
    const state = withFrame()
    expect(officeReducer(state, { type: 'floor-stepped', delta: -1 }).focusedFloorId).toBe('f1')
    expect(officeReducer(state, { type: 'floor-stepped', delta: 1 }).focusedFloorId).toBe('f2')
    expect(officeReducer(state, { type: 'floor-numbered', number: 1 }).focusedFloorId).toBe('f1')
    expect(officeReducer(state, { type: 'floor-numbered', number: 9 }).focusedFloorId).toBe('f2')
  })

  it('clears a selection whose agent left the floor or the frame', () => {
    const selected = officeReducer(withFrame(), { type: 'agent-selected', agentKey: 'b' })
    expect(
      officeReducer(selected, { type: 'floor-selected', floorId: 'f1' }).selectedAgentKey
    ).toBeNull()
    const emptied = officeReducer(selected, { type: 'frame-received', frame: makeFrame() })
    expect(emptied.selectedAgentKey).toBeNull()
    expect(emptied.focusedFloorId).toBeNull()
  })

  it('only flies to the selected agent when one is selected', () => {
    expect(officeReducer(withFrame(), { type: 'fly-to-selected' }).cameraRequest).toBeNull()
    const selected = officeReducer(withFrame(), { type: 'agent-selected', agentKey: 'c' })
    expect(officeReducer(selected, { type: 'fly-to-selected' }).cameraRequest).toMatchObject({
      kind: 'fly',
      agentKey: 'c'
    })
  })

  it('turns a zoom key into a camera request', () => {
    expect(
      officeReducer(withFrame(), { type: 'camera-zoomed', direction: 'out' }).cameraRequest
    ).toMatchObject({
      kind: 'zoom',
      direction: 'out'
    })
  })

  it('toggles walls, list view and metrics', () => {
    let state = officeReducer(withFrame(), { type: 'walls-set', mode: 'down' })
    state = officeReducer(state, { type: 'list-toggled' })
    state = officeReducer(state, { type: 'metrics-toggled' })
    expect(state).toMatchObject({ wallsMode: 'down', isListView: true, isMetricsVisible: true })
  })
})
