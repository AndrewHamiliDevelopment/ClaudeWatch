import {
  buildLayout,
  type LayoutMap,
  type RoomLayout,
  type ZoneLayout
} from '../../office/sim/layout'
import type { SessionRef } from '../../shared/office/types'
import type { FloorGeometry, RoomGeometry, ZoneGeometry } from '../office/scene-model'

function toZone(zone: ZoneLayout, labels: Map<string, string>): ZoneGeometry {
  return {
    id: zone.id,
    kind: zone.kind,
    label: zone.sessionKey ? (labels.get(zone.sessionKey) ?? zone.label) : zone.label,
    x: zone.x,
    z: zone.z,
    width: zone.width,
    depth: zone.depth,
    door: { ...zone.door },
    companyKey: zone.companyKey,
    projectKey: zone.projectKey,
    sessionKey: zone.sessionKey,
    children: zone.children.map((child) => toZone(child, labels))
  }
}

function toRoom(room: RoomLayout, labels: Map<string, string>): RoomGeometry {
  return {
    id: room.id,
    sessionKey: room.sessionKey,
    x: room.x,
    z: room.z,
    width: room.width,
    depth: room.depth,
    door: { ...room.door },
    label: room.sessionKey ? (labels.get(room.sessionKey) ?? room.label) : room.label,
    kind: room.kind,
    ...(room.kind === 'office' ? { bay: room.bay } : {}),
    seats: room.slots
      .filter((slot) => slot.id !== 'door')
      .map((slot) => ({ slotId: slot.id, x: slot.x, z: slot.z, heading: slot.heading }))
  }
}

export function toFloorGeometry(layout: LayoutMap, sessions: SessionRef[]): FloorGeometry[] {
  const labels = new Map(sessions.map((s) => [s.key, s.name]))
  // A map saved by the floor-per-project version has no zones and is replaced, as buildLayout does.
  const floor = layout.floors[0]?.zones
    ? layout.floors[0]
    : buildLayout(sessions, undefined, 0).floors[0]
  return [
    {
      floorId: 'hq',
      label: floor.label,
      plate: 0,
      width: floor.width,
      depth: floor.depth,
      corridor: { z: 0, width: 3 },
      rooms: floor.rooms.map((r) => toRoom(r, labels)),
      zones: floor.zones.map((z) => toZone(z, labels)),
      elevator: { x: floor.elevator.x, z: floor.elevator.z }
    }
  ]
}
