import type { ComponentType, RefObject } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { AgentView, ProviderId } from '../../../shared/office/types'
import type { FloorGeometry, RoomGeometry } from '../scene-model'
import type { DeskSlot, WallsMode } from '../logic/room-layout'

export interface ThemePalette {
  lacquer: string
  ink: string
  gold: string
  brass: string
  copper: string
  paper: string
  wood: string
  floor: string
  stone: string
  blossom: string
  glow: string
  steam: string
}

export interface RobotSkin {
  label: string
  body: string
  trim: string
  eye: string
}

export interface RobotRig {
  body: RefObject<Group | null>
  head: RefObject<Group | null>
  leftArm: RefObject<Group | null>
  rightArm: RefObject<Group | null>
  gear: RefObject<Group | null>
  legs: RefObject<Group | null>
  base: RefObject<Group | null>
  sensor: RefObject<Group | null>
  eye: RefObject<Mesh | null>
  thought: RefObject<Group | null>
  puffs: readonly RefObject<Mesh | null>[]
  puffMaterials: readonly RefObject<MeshStandardMaterial | null>[]
}

// Root translation, scale, hit capsule and selection remain owned by Robot's controller.
export interface RobotModelProps {
  agent: AgentView
  skin: RobotSkin
  rig: RobotRig
  isReducedMotion: boolean
}

export interface FloorProps {
  floor: FloorGeometry
}
export interface WallsProps extends FloorProps {
  mode: WallsMode
  isReducedMotion: boolean
}
export interface RoomProps {
  room: RoomGeometry
}
export interface DeskProps extends RoomProps {
  slot: DeskSlot
}
export interface TowerFloor {
  floorId: string
  label: string
  agentCount?: number
  attentionCount: number
}
export interface TowerProps {
  onFocusFloor?: (floorId: string) => void
  floors: readonly TowerFloor[]
}

export interface OfficeTheme {
  id: string
  label: string
  description: string
  palette: ThemePalette
  robot: { Model: ComponentType<RobotModelProps>; skins: Record<ProviderId, RobotSkin> }
  kit: {
    Floor: ComponentType<FloorProps>
    Walls: ComponentType<WallsProps>
    Doorway: ComponentType<RoomProps>
    Desk: ComponentType<DeskProps>
    RoomDressing: ComponentType<RoomProps>
    Elevator: ComponentType<FloorProps>
    RoomSign: ComponentType<RoomProps>
  }
  world: {
    District: ComponentType<FloorProps>
    Hangar: ComponentType<FloorProps>
    Tower: ComponentType<TowerProps>
  }
}
