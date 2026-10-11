import type { ReactNode } from 'react'
import { InstancedParts, Matte } from '../scene/InstancedParts'
import type { InstancePlacement } from '../scene/instancing'

export type Vector = [number, number, number]

export function Box({
  at = [0, 0, 0],
  size,
  color,
  glow = false
}: {
  at?: Vector
  size: Vector
  color: string
  glow?: boolean
}) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <Matte color={color} glow={glow} />
    </mesh>
  )
}

export function Cylinder({
  at = [0, 0, 0],
  radius,
  height,
  color
}: {
  at?: Vector
  radius: number
  height: number
  color: string
}) {
  return (
    <mesh position={at}>
      <cylinderGeometry args={[radius, radius, height, 8]} />
      <Matte color={color} />
    </mesh>
  )
}

export function Batch({
  points,
  color,
  children,
  glow = false
}: {
  points: readonly InstancePlacement[]
  color: string
  children: ReactNode
  glow?: boolean
}) {
  return (
    <InstancedParts placements={points}>
      {children}
      <Matte color={color} glow={glow} />
    </InstancedParts>
  )
}

export function Lantern({ at, color, frame }: { at: Vector; color: string; frame: string }) {
  return (
    <group position={at}>
      <mesh>
        <sphereGeometry args={[0.22, 8, 6]} />
        <Matte color={color} glow />
      </mesh>
      <Cylinder at={[0, 0.2, 0]} radius={0.13} height={0.06} color={frame} />
      <Cylinder at={[0, -0.2, 0]} radius={0.13} height={0.06} color={frame} />
    </group>
  )
}
