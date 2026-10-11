import { useMemo } from 'react'
import { DESK_REACH, deskSlots, type DeskSlot } from '../logic/room-layout'
import { STEAM } from '../office-palette'
import type { RoomGeometry } from '../scene-model'
import type { InstancePlacement } from './instancing'
import { InstancedParts, Matte } from './InstancedParts'

const DESK = { width: 1.2, height: 0.62, depth: 0.62 }
const CRT = { size: 0.36, reach: DESK_REACH + 0.1 }
const LAMP = { across: 0.42, reach: DESK_REACH + 0.12 }
const STOOL_HEIGHT = 0.32

function place(slot: DeskSlot, forward: number, across: number, y: number): InstancePlacement {
  const sin = Math.sin(slot.heading)
  const cos = Math.cos(slot.heading)
  return {
    x: slot.x + sin * forward + cos * across,
    y,
    z: slot.z + cos * forward - sin * across,
    rotationY: slot.heading
  }
}

// Dark-wood desk, a little green CRT, a brass lamp and a stool for every slot on the floor.
export function Furniture({ rooms }: { rooms: readonly RoomGeometry[] }) {
  const parts = useMemo(() => {
    const slots = rooms.flatMap(deskSlots)
    const top = DESK.height
    return {
      desks: slots.map((slot) => place(slot, DESK_REACH, 0, top / 2)),
      crts: slots.map((slot) => place(slot, CRT.reach, 0, top + CRT.size / 2)),
      screens: slots.map((slot) =>
        place(slot, CRT.reach - CRT.size / 2 - 0.005, 0, top + CRT.size / 2)
      ),
      lampPoles: slots.map((slot) => place(slot, LAMP.reach, LAMP.across, top + 0.18)),
      lampShades: slots.map((slot) => place(slot, LAMP.reach, LAMP.across, top + 0.38)),
      stools: slots.map((slot) => place(slot, 0, 0, STOOL_HEIGHT / 2))
    }
  }, [rooms])

  return (
    <>
      <InstancedParts placements={parts.desks}>
        <boxGeometry args={[DESK.width, DESK.height, DESK.depth]} />
        <Matte color={STEAM.darkWood} />
      </InstancedParts>
      <InstancedParts placements={parts.crts}>
        <boxGeometry args={[CRT.size * 1.15, CRT.size, CRT.size]} />
        <Matte color={STEAM.crtBody} />
      </InstancedParts>
      <InstancedParts placements={parts.screens}>
        <boxGeometry args={[CRT.size * 0.9, CRT.size * 0.72, 0.01]} />
        <Matte color={STEAM.crtScreen} glow />
      </InstancedParts>
      <InstancedParts placements={parts.lampPoles}>
        <cylinderGeometry args={[0.02, 0.05, 0.36, 6]} />
        <Matte color={STEAM.brass} />
      </InstancedParts>
      <InstancedParts placements={parts.lampShades}>
        <coneGeometry args={[0.11, 0.12, 8]} />
        <Matte color={STEAM.lampGlow} glow />
      </InstancedParts>
      <InstancedParts placements={parts.stools}>
        <cylinderGeometry args={[0.2, 0.16, STOOL_HEIGHT, 10]} />
        <Matte color={STEAM.copper} />
      </InstancedParts>
    </>
  )
}
