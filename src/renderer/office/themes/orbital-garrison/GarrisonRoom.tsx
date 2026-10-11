import { useMemo } from 'react'
import { DESK_REACH, doorSignPlacement } from '../../logic/room-layout'
import type { InstancePlacement } from '../../scene/instancing'
import { Batch } from '../primitives'
import type { DeskProps, RoomProps, RoomsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { box, Parts, turned, type PartSpec } from '../parts'
import { BRIDGE, frameParts, GANTRY } from './frame-parts'
import { GARRISON } from './palette'
import { parkingSpot } from './parking'
import { dressingForBay } from './roster'

const PLATE = 0.9
const SEAM = 0.05
const PLATE_Y = 0.012

// Steel deck plates with dark seams, and a hazard strip across every threshold.
export function GarrisonRoomFloors({ rooms }: RoomsProps) {
  const deck = useMemo(() => {
    const plates: InstancePlacement[] = []
    const thresholds: InstancePlacement[] = []
    for (const room of rooms) {
      const columns = Math.max(1, Math.round(room.width / PLATE))
      const rows = Math.max(1, Math.round(room.depth / PLATE))
      for (let column = 0; column < columns; column++)
        for (let row = 0; row < rows; row++)
          plates.push({
            x: room.x - room.width / 2 + ((column + 0.5) * room.width) / columns,
            y: PLATE_Y,
            z: room.z - room.depth / 2 + ((row + 0.5) * room.depth) / rows,
            rotationY: 0,
            scaleX: room.width / columns - SEAM,
            scaleY: 0.02,
            scaleZ: room.depth / rows - SEAM
          })
      thresholds.push({
        x: room.door.x,
        y: PLATE_Y + 0.004,
        z: room.door.z,
        rotationY: doorSignPlacement(room).rotationY,
        scaleX: 1.1,
        scaleY: 0.02,
        scaleZ: 0.22
      })
    }
    return { plates, thresholds }
  }, [rooms])
  return (
    <>
      <Batch color={GARRISON.gunmetal} points={deck.plates}>
        {UNIT_SHAPES.box}
      </Batch>
      <Batch color={GARRISON.orange} points={deck.thresholds}>
        {UNIT_SHAPES.box}
      </Batch>
    </>
  )
}

const lit = (part: PartSpec): PartSpec => ({ ...part, glow: true })

// A bulkhead door frame on hazard footings, with a status light on each face.
const DOOR_FRAME: PartSpec[] = [
  ...[-1, 1].flatMap((side) => [
    box([side * 0.62, 0.66, 0], [0.12, 1.32, 0.2], GARRISON.gunmetal),
    box([side * 0.62, 0.12, 0], [0.14, 0.24, 0.22], GARRISON.orange),
    lit(box([0, 1.38, side * 0.115], [0.24, 0.05, 0.012], GARRISON.ice))
  ]),
  box([0, 1.38, 0], [1.36, 0.14, 0.22], GARRISON.gunmetal)
]

export function GarrisonDoorway({ room }: RoomProps) {
  const sign = doorSignPlacement(room)
  return (
    <group position={[room.door.x, 0, room.door.z]} rotation={[0, sign.rotationY, 0]}>
      <Parts parts={DOOR_FRAME} />
    </group>
  )
}

const SCREEN_GAP = 0.02

// One console screen: a dark casing whose lit face is turned toward the seat.
function screen(x: number, z: number, yaw: number, width: number): PartSpec[] {
  const face: PartSpec = lit(
    box(
      [x - Math.sin(yaw) * SCREEN_GAP, 0.73, z - Math.cos(yaw) * SCREEN_GAP],
      [width - 0.06, 0.24, 0.01],
      GARRISON.ice
    )
  )
  return [
    turned(box([x, 0.73, z], [width, 0.3, 0.035], GARRISON.hull), [0, yaw, 0]),
    turned(face, [0, yaw, 0])
  ]
}

// A console with a lit chart board between two angled screens, so the viewer sees whoever works
// at it; a flight seat stands behind them.
const CONSOLE: PartSpec[] = [
  box([0, 0.23, DESK_REACH], [0.9, 0.46, 0.36], GARRISON.gunmetal),
  box([0, 0.49, DESK_REACH], [1.3, 0.06, 0.6], GARRISON.steel),
  box([0, 0.49, DESK_REACH + 0.3], [1.32, 0.065, 0.03], GARRISON.orange),
  lit(box([0, 0.525, DESK_REACH + 0.02], [0.46, 0.012, 0.4], GARRISON.ice)),
  box([0, 0.535, DESK_REACH - 0.06], [0.3, 0.012, 0.1], GARRISON.navy),
  ...screen(-0.46, DESK_REACH + 0.08, -0.6, 0.36),
  ...screen(0.46, DESK_REACH + 0.08, 0.6, 0.36),
  box([0, 0.42, -0.3], [0.42, 0.84, 0.07], GARRISON.hull),
  box([0, 0.88, -0.3], [0.28, 0.1, 0.09], GARRISON.orange)
]

export function GarrisonDesk({ slot }: DeskProps) {
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.heading, 0]}>
      <Parts parts={CONSOLE} />
    </group>
  )
}

const FRAME_SCALE = 0.8

// Behind the crew: the commander's bridge in the lead office, a parked frame in every other.
export function GarrisonRoomDressing({ room }: RoomProps) {
  const spot = parkingSpot(room)
  const dressing = dressingForBay(room.bay)
  const frame = useMemo(() => (dressing === 'bridge' ? null : frameParts(dressing)), [dressing])
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.heading, 0]}>
      {frame ? (
        <>
          <Parts parts={GANTRY} />
          <group position={[0, 0.06, 0]} scale={FRAME_SCALE}>
            <Parts parts={frame} />
          </group>
        </>
      ) : (
        <Parts parts={BRIDGE} />
      )}
    </group>
  )
}
