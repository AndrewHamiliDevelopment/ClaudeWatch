import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import type { ThemeZoneGroup } from '../logic/office-themes'
import { groundHeight } from '../player/walk-ground'
import type { Player } from '../player/walking'
import type { FloorGeometry } from '../scene-model'
import type { Lot } from '../themes/surroundings'
import type { OfficeTheme } from '../themes/types'
import { citizenFigures, citizenGeometry } from './figures'
import { routePose, walkedSec } from './route-pose'
import { CITIZEN_CAP } from './routes'
import { citizenKinds, townCitizens } from './town'

interface CitizenLayerProps {
  floor: FloorGeometry
  // Everything that stands on the ground: the same list the streets are laid round.
  solids: readonly Lot[]
  floorTheme: OfficeTheme
  zoneGroups: readonly ThemeZoneGroup[]
  player: Player | null | undefined
  isReducedMotion: boolean
  // The part of the town's citizens this machine's detail level can afford, 0 to 1.
  share?: number
}

// A window coming back from hidden reports the whole gap as one frame: it is walked as this much.
const MAX_STEP_SEC = 0.25
const TURN_PER_SEC = 7
const STRIDE_M = 0.3
const BOB_M = 0.02

const scratch = new Object3D()

function turnToward(from: number, to: number, share: number): number {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + gap * Math.min(1, share)
}

// The townsfolk on the streets: one instanced draw per kind of figure, moved by writing matrices.
// It asks for no frames of its own, so they walk only on frames the scene draws anyway.
export function CitizenLayer(props: CitizenLayerProps) {
  const { floor, solids, floorTheme, zoneGroups, player, isReducedMotion, share = 1 } = props
  const citizens = useMemo(() => {
    const themeIdByZone = new Map(
      zoneGroups.flatMap(({ themeId, companies }) =>
        companies.map((company) => [company.id, themeId] as const)
      )
    )
    return townCitizens({ floor, lots: solids, floorThemeId: floorTheme.id, themeIdByZone, share })
  }, [floor, solids, floorTheme.id, zoneGroups, share])
  const kinds = useMemo(() => citizenKinds(citizens), [citizens])
  // Keyed by what is drawn, so a floor that re-packs with the same kinds uploads nothing new.
  const kindsKey = kinds.map((kind) => kind.key).join('|')
  const geometries = useMemo(
    () => kinds.map((kind) => citizenGeometry(citizenFigures(kind.themeId)[kind.figure])),
    [kindsKey]
  )
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

  const meshesRef = useRef<(InstancedMesh | null)[]>([])
  // Seconds walked and the way each faces, by citizen: kept across a floor that re-packs.
  const walkedRef = useRef(new Float32Array(CITIZEN_CAP))
  const headingsRef = useRef(new Float32Array(CITIZEN_CAP))

  const place = (deltaSec: number): void => {
    const walked = walkedRef.current
    const headings = headingsRef.current
    kinds.forEach((kind, kindIndex) => {
      const mesh = meshesRef.current[kindIndex]
      if (!mesh) return
      kind.members.forEach((citizenIndex, instance) => {
        const { route, speed } = citizens[citizenIndex]
        if (deltaSec > 0)
          walked[citizenIndex] = walkedSec({
            route,
            speed,
            walked: walked[citizenIndex],
            deltaSec,
            player: player?.position ?? null
          })
        const travelled = isReducedMotion ? 0 : walked[citizenIndex] * speed
        const pose = routePose(route, travelled)
        headings[citizenIndex] =
          deltaSec > 0
            ? turnToward(headings[citizenIndex], pose.heading, deltaSec * TURN_PER_SEC)
            : pose.heading
        const bob = Math.abs(Math.sin((travelled / STRIDE_M) * Math.PI)) * BOB_M
        scratch.position.set(pose.x, groundHeight(floor, pose) + bob, pose.z)
        scratch.rotation.y = headings[citizenIndex]
        scratch.updateMatrix()
        mesh.setMatrixAt(instance, scratch.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  // Placed on every commit: under reduced motion this is where they stay, at their routes' starts.
  useLayoutEffect(() => place(0))
  useFrame((_state, deltaSec) => {
    if (!isReducedMotion) place(Math.min(deltaSec, MAX_STEP_SEC))
  })

  return (
    <>
      {kinds.map((kind, kindIndex) => (
        <instancedMesh
          key={`${kind.key}:${kind.members.length}`}
          ref={(mesh) => {
            meshesRef.current[kindIndex] = mesh
          }}
          args={[geometries[kindIndex], undefined, kind.members.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
        </instancedMesh>
      ))}
    </>
  )
}
