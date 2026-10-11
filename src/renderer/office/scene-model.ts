import type {
  AgentView,
  InteractionResult,
  PeekResult,
  PermissionDecision,
  ProviderId,
  SessionRef
} from '../../shared/office/types'

// All lengths in metres, floor-local, 1 unit = 1 m, Y up. Plain data: Phase 6 maps the sim's LayoutMap into it.
// The floor-local origin is the centre of the floor plate; room x/z is the room centre.
export interface RoomGeometry {
  id: string
  sessionKey: string | null
  x: number
  z: number
  width: number
  depth: number
  door: { x: number; z: number }
  label: string
  kind: 'office' | 'team'
}

export interface FloorGeometry {
  floorId: string
  label: string
  plate: number
  width: number
  depth: number
  corridor: { z: number; width: number }
  rooms: RoomGeometry[]
  elevator: { x: number; z: number }
}

export interface OfficeFrame {
  floors: FloorGeometry[]
  agents: AgentView[]
  sessions: SessionRef[]
}

export interface OfficeFeed {
  subscribe(listener: (frame: OfficeFrame) => void): () => void
  jump(sessionKey: string): void
  send(sessionKey: string, text: string): Promise<InteractionResult>
  respond(
    sessionKey: string,
    decision: PermissionDecision,
    fingerprint: string
  ): Promise<InteractionResult>
  peek(sessionKey: string): Promise<PeekResult>
  start(projectKey: string, provider: ProviderId): Promise<InteractionResult>
}
