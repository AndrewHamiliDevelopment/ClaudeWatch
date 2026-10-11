import { useMemo } from 'react'
import { deskSlots, doorSide, doorSignPlacement, type WallsMode } from '../logic/room-layout'
import { STEAM } from '../office-palette'
import type { FloorGeometry, RoomGeometry } from '../scene-model'
import type { InstancePlacement } from './instancing'
import { InstancedParts, Matte } from './InstancedParts'
import { Elevator } from './Elevator'
import { Furniture } from './Furniture'
import { signTexture } from './textures'
import { Walls } from './Walls'

const SLAB_THICKNESS = 0.3
const FLOOR_LIFT = 0.004
const FLAT = -Math.PI / 2
const ARCH = { radius: 0.58, tube: 0.07, legHeight: 0.7 }
const SIGN = { width: 1.7, height: 0.35, y: 1.62 }
const BOILER = { radius: 0.26, height: 0.95, inset: 0.55 }

function archParts(rooms: readonly RoomGeometry[]) {
  const signs = rooms.map(doorSignPlacement)
  const along = (rotationY: number, offset: number) => ({
    x: Math.cos(rotationY) * offset,
    z: -Math.sin(rotationY) * offset
  })
  return {
    arches: signs.map(
      (sign): InstancePlacement => ({
        x: sign.x,
        y: ARCH.legHeight,
        z: sign.z,
        rotationY: sign.rotationY
      })
    ),
    legs: signs.flatMap((sign) =>
      [-1, 1].map((side): InstancePlacement => {
        const offset = along(sign.rotationY, side * ARCH.radius)
        return { x: sign.x + offset.x, y: ARCH.legHeight / 2, z: sign.z + offset.z, rotationY: 0 }
      })
    ),
    lights: signs.flatMap((sign) =>
      [-1, 1].map((side): InstancePlacement => {
        const offset = along(sign.rotationY, side * ARCH.radius)
        return {
          x: sign.x + offset.x,
          y: ARCH.legHeight + 0.02,
          z: sign.z + offset.z,
          rotationY: 0
        }
      })
    )
  }
}

// A copper boiler in the room corner opposite the main desk's right hand.
function boilerFor(room: RoomGeometry): InstancePlacement {
  const side = doorSide(room)
  const isDoorOnZ = side === 'north' || side === 'south'
  const [main] = deskSlots(room)
  const backReach = (isDoorOnZ ? room.depth : room.width) / 2 - BOILER.inset
  const backX = Math.sin(main.heading) * backReach
  const backZ = Math.cos(main.heading) * backReach
  const acrossOffset = (isDoorOnZ ? room.width : room.depth) / 2 - BOILER.inset
  return {
    x: room.x + backX + (isDoorOnZ ? acrossOffset : 0),
    y: BOILER.height / 2,
    z: room.z + backZ + (isDoorOnZ ? 0 : acrossOffset),
    rotationY: main.heading
  }
}

export function FloorView({
  floor,
  wallsMode,
  isReducedMotion
}: {
  floor: FloorGeometry
  wallsMode: WallsMode
  isReducedMotion: boolean
}) {
  const doors = useMemo(() => archParts(floor.rooms), [floor.rooms])
  const boilers = useMemo(() => floor.rooms.map(boilerFor), [floor.rooms])
  const gauges = useMemo(
    () => boilers.map((boiler) => ({ ...boiler, y: BOILER.height + 0.12 })),
    [boilers]
  )

  return (
    <group>
      <mesh position={[0, -SLAB_THICKNESS / 2, 0]}>
        <boxGeometry args={[floor.width + 1, SLAB_THICKNESS, floor.depth + 1]} />
        <Matte color={STEAM.slab} />
      </mesh>
      <mesh position={[0, FLOOR_LIFT, floor.corridor.z]} rotation={[FLAT, 0, 0]}>
        <planeGeometry args={[floor.width, floor.corridor.width]} />
        <Matte color={STEAM.iron} />
      </mesh>
      {floor.rooms.map((room) => {
        const sign = doorSignPlacement(room)
        return (
          <group key={room.id}>
            <mesh position={[room.x, FLOOR_LIFT * 2, room.z]} rotation={[FLAT, 0, 0]}>
              <planeGeometry args={[room.width, room.depth]} />
              <Matte color={room.kind === 'team' ? STEAM.ironLight : STEAM.floorWood} />
            </mesh>
            <mesh position={[sign.x, SIGN.y, sign.z]} rotation={[0, sign.rotationY, 0]}>
              <planeGeometry args={[SIGN.width, SIGN.height]} />
              <meshBasicMaterial map={signTexture(room.label)} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
      <InstancedParts placements={doors.arches}>
        <torusGeometry args={[ARCH.radius, ARCH.tube, 6, 16, Math.PI]} />
        <Matte color={STEAM.brass} />
      </InstancedParts>
      <InstancedParts placements={doors.legs}>
        <cylinderGeometry args={[ARCH.tube, ARCH.tube, ARCH.legHeight, 8]} />
        <Matte color={STEAM.brass} />
      </InstancedParts>
      <InstancedParts placements={doors.lights}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <Matte color={STEAM.rivetLight} glow />
      </InstancedParts>
      <InstancedParts placements={boilers}>
        <cylinderGeometry args={[BOILER.radius, BOILER.radius, BOILER.height, 12]} />
        <Matte color={STEAM.copper} />
      </InstancedParts>
      <InstancedParts placements={gauges}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <Matte color={STEAM.cream} />
      </InstancedParts>
      <Walls rooms={floor.rooms} mode={wallsMode} isReducedMotion={isReducedMotion} />
      <Furniture rooms={floor.rooms} />
      <Elevator floor={floor} />
    </group>
  )
}
