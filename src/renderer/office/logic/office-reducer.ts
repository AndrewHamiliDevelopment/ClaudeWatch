import type { OfficeFrame } from '../scene-model'
import { buildAttentionQueue, nextAttentionKey } from './attention-queue'
import type { ZoomDirection } from './camera-bands'
import { mainAgentForSession, sessionForAgent } from './floor-model'
import type { WallsMode } from './room-layout'

// `nonce` makes a repeated request (fly to the same agent twice) still fire the camera effect.
export type CameraRequest =
  | { kind: 'fly'; agentKey: string; nonce: number }
  | { kind: 'rotate'; direction: -1 | 1; nonce: number }
  | { kind: 'zoom'; direction: ZoomDirection; nonce: number }

export interface OfficeState {
  frame: OfficeFrame | null
  focusedFloorId: string | null
  selectedAgentKey: string | null
  // The session whose permission prompt is open for review in the inspector.
  reviewingSessionKey: string | null
  wallsMode: WallsMode
  isListView: boolean
  isMetricsVisible: boolean
  cameraRequest: CameraRequest | null
}

export type OfficeAction =
  | { type: 'frame-received'; frame: OfficeFrame }
  | { type: 'floor-selected'; floorId: string }
  | { type: 'floor-stepped'; delta: -1 | 1 }
  | { type: 'floor-numbered'; number: number }
  | { type: 'agent-selected'; agentKey: string | null }
  | { type: 'agent-flown'; agentKey: string }
  | { type: 'session-opened'; sessionKey: string }
  | { type: 'review-opened'; sessionKey: string }
  | { type: 'review-closed' }
  | { type: 'next-attention' }
  | { type: 'fly-to-selected' }
  | { type: 'camera-rotated'; direction: -1 | 1 }
  | { type: 'camera-zoomed'; direction: ZoomDirection }
  | { type: 'walls-set'; mode: WallsMode }
  | { type: 'list-toggled' }
  | { type: 'metrics-toggled' }

export const INITIAL_OFFICE_STATE: OfficeState = {
  frame: null,
  focusedFloorId: null,
  selectedAgentKey: null,
  reviewingSessionKey: null,
  wallsMode: 'cutaway',
  isListView: false,
  isMetricsVisible: false,
  cameraRequest: null
}

function nextNonce(state: OfficeState): number {
  return (state.cameraRequest?.nonce ?? 0) + 1
}

function defaultFloorId(frame: OfficeFrame): string | null {
  const [head] = buildAttentionQueue(frame.sessions)
  const waiting = head ? mainAgentForSession(frame, head.sessionKey) : undefined
  return waiting?.floorId ?? frame.floors[0]?.floorId ?? null
}

function focusFloor(state: OfficeState, floorId: string | undefined): OfficeState {
  if (!floorId || !state.frame) return state
  const selected = state.frame.agents.find((agent) => agent.agentKey === state.selectedAgentKey)
  return {
    ...state,
    focusedFloorId: floorId,
    selectedAgentKey: selected?.floorId === floorId ? state.selectedAgentKey : null
  }
}

function flyTo(state: OfficeState, agentKey: string): OfficeState {
  const agent = state.frame?.agents.find((candidate) => candidate.agentKey === agentKey)
  if (!agent) return state
  return {
    ...state,
    focusedFloorId: agent.floorId,
    selectedAgentKey: agentKey,
    cameraRequest: { kind: 'fly', agentKey, nonce: nextNonce(state) }
  }
}

function receiveFrame(state: OfficeState, frame: OfficeFrame): OfficeState {
  const hasFocusedFloor = frame.floors.some((floor) => floor.floorId === state.focusedFloorId)
  const hasSelectedAgent = frame.agents.some((agent) => agent.agentKey === state.selectedAgentKey)
  return {
    ...state,
    frame,
    focusedFloorId: hasFocusedFloor ? state.focusedFloorId : defaultFloorId(frame),
    selectedAgentKey: hasSelectedAgent ? state.selectedAgentKey : null
  }
}

function openNextAttention(state: OfficeState): OfficeState {
  if (!state.frame) return state
  const selected = state.frame.agents.find((agent) => agent.agentKey === state.selectedAgentKey)
  const currentSessionKey = selected ? (sessionForAgent(state.frame, selected)?.key ?? null) : null
  const nextKey = nextAttentionKey(buildAttentionQueue(state.frame.sessions), currentSessionKey)
  const agent = nextKey ? mainAgentForSession(state.frame, nextKey) : undefined
  return agent ? flyTo(state, agent.agentKey) : state
}

function floorAt(state: OfficeState, index: number): string | undefined {
  const floors = state.frame?.floors ?? []
  return floors[Math.min(Math.max(index, 0), floors.length - 1)]?.floorId
}

export function officeReducer(state: OfficeState, action: OfficeAction): OfficeState {
  switch (action.type) {
    case 'frame-received':
      return receiveFrame(state, action.frame)
    case 'floor-selected':
      return focusFloor(state, action.floorId)
    case 'floor-stepped': {
      const index = state.frame?.floors.findIndex((floor) => floor.floorId === state.focusedFloorId)
      return focusFloor(state, floorAt(state, (index ?? 0) + action.delta))
    }
    case 'floor-numbered':
      return focusFloor(state, floorAt(state, action.number - 1))
    case 'agent-selected':
      return {
        ...state,
        selectedAgentKey: action.agentKey,
        reviewingSessionKey:
          action.agentKey === state.selectedAgentKey ? state.reviewingSessionKey : null
      }
    case 'agent-flown':
      return flyTo(state, action.agentKey)
    case 'session-opened': {
      const agent = state.frame ? mainAgentForSession(state.frame, action.sessionKey) : undefined
      return agent ? flyTo(state, agent.agentKey) : state
    }
    case 'review-opened': {
      const agent = state.frame ? mainAgentForSession(state.frame, action.sessionKey) : undefined
      return agent
        ? { ...flyTo(state, agent.agentKey), reviewingSessionKey: action.sessionKey }
        : state
    }
    case 'review-closed':
      return { ...state, reviewingSessionKey: null }
    case 'next-attention':
      return openNextAttention(state)
    case 'fly-to-selected':
      return state.selectedAgentKey ? flyTo(state, state.selectedAgentKey) : state
    case 'camera-rotated':
      return {
        ...state,
        cameraRequest: { kind: 'rotate', direction: action.direction, nonce: nextNonce(state) }
      }
    case 'camera-zoomed':
      return {
        ...state,
        cameraRequest: { kind: 'zoom', direction: action.direction, nonce: nextNonce(state) }
      }
    case 'walls-set':
      return { ...state, wallsMode: action.mode }
    case 'list-toggled':
      return { ...state, isListView: !state.isListView }
    case 'metrics-toggled':
      return { ...state, isMetricsVisible: !state.isMetricsVisible }
    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}
