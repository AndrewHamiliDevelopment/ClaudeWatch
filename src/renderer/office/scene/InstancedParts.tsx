import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { InstancedMesh } from 'three'
import { writeInstances, type InstancePlacement } from './instancing'

// One draw call per part kind per floor; children supply the geometry and material.
export function InstancedParts({
  placements,
  children
}: {
  placements: readonly InstancePlacement[]
  children: ReactNode
}) {
  const meshRef = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (meshRef.current) writeInstances(meshRef.current, placements)
  }, [placements])
  return (
    <instancedMesh
      key={placements.length}
      ref={meshRef}
      args={[undefined, undefined, Math.max(placements.length, 1)]}
      frustumCulled={false}
    >
      {children}
    </instancedMesh>
  )
}

// Soft, low-metal shading for the whole kit (no environment map, so high metalness would read black).
export function Matte({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.8}
      metalness={0.15}
      emissive={glow ? color : '#000000'}
      emissiveIntensity={glow ? 0.9 : 0}
    />
  )
}
