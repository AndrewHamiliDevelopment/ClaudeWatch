import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import type { ThemeZoneGroup } from '../logic/office-themes'
import { levelInUse } from '../logic/quality'
import { groundHeight } from '../player/walk-ground'
import type { Player } from '../player/walking'
import { useQualityChoice } from '../quality-store'
import type { FloorGeometry } from '../scene-model'
import { getTheme } from '../themes/registry'
import type { OfficeTheme } from '../themes/types'
import type { TownPlan } from '../town/town-plan'
import { townTrips, type MoverKind } from '../town/town-trips'
import { citizenGeometry } from './figure-parts'
import { moverFigure, moverKinds } from './mover-kinds'
import { routePose, walkedSec, type RoutePoint } from './route-pose'

interface MoverLayerProps {
  floor: FloorGeometry
  plan: TownPlan
  // Lot id to the company that dresses it (`lotOwners`).
  owners: ReadonlyMap<string, string>
  floorTheme: OfficeTheme
  zoneGroups: readonly ThemeZoneGroup[]
  player: Player | null | undefined
  isReducedMotion: boolean
  // The settings panel's switch.
  hasVehicles: boolean
}

// A window coming back from hidden reports the whole gap as one frame: it is moved as this much.
const MAX_STEP_SEC = 0.25
const TURN_PER_SEC = 7
const STRIDE_M = 0.3
const BOB_M = 0.02
// How far ahead of its middle a vehicle's nose is, and how near that may come to anyone on foot:
// under the 1.5 m between a lane's middle and the pavement beside it.
const NOSE_M: Record<Exclude<MoverKind, 'citizen'>, number> = {
  transit: 3,
  freight: 2,
  runabout: 1.4
}
const VEHICLE_HOLD_M = 1.4

const scratch = new Object3D()

function turnToward(from: number, to: number, share: number): number {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + gap * Math.min(1, share)
}

// The town's citizens and vehicles: one instanced draw per kind of figure, moved by writing
// matrices. It asks for no frames of its own, so they move only on frames the scene draws anyway.
export function MoverLayer(props: MoverLayerProps) {
  const { floor, plan, owners, floorTheme, zoneGroups, player, isReducedMotion } = props
  const { hasVehicles } = props
  const { pin, chosen } = useQualityChoice()
  const detail = levelInUse(pin, chosen)
  // Keyed by what they say, not by identity: a floor change that moves no lot keeps every trip,
  // and with it how far each mover has got.
  const ownersKey = [...owners].join('|')
  const themesKey = zoneGroups
    .map(({ themeId, companies }) => `${themeId}=${companies.map((zone) => zone.id).join(',')}`)
    .join('|')
  const trips = useMemo(() => {
    const themeIdByZone = new Map(
      zoneGroups.flatMap(({ themeId, companies }) =>
        companies.map((company) => [company.id, themeId] as const)
      )
    )
    return townTrips({
      plan,
      owners,
      floorThemeId: floorTheme.id,
      themeIdByZone,
      detail,
      hasVehicles
    })
  }, [plan, ownersKey, themesKey, floorTheme.id, detail, hasVehicles])
  const kinds = useMemo(() => moverKinds(trips), [trips])
  // Keyed by what is drawn, so trips that change with the same kinds upload nothing new.
  const kindsKey = kinds.map((kind) => kind.key).join('|')
  const geometries = useMemo(
    () => kinds.map((kind) => citizenGeometry(moverFigure(kind, getTheme(kind.themeId)))),
    [kindsKey]
  )
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

  const meshesRef = useRef<(InstancedMesh | null)[]>([])
  // Seconds on its route and the way it faces, by mover: every loop begins part-way round.
  const clock = useMemo(() => {
    const onFoot: RoutePoint[] = []
    return {
      moved: Float32Array.from(trips, (trip) => trip.startSec),
      headings: new Float32Array(trips.length),
      onFoot
    }
  }, [trips])

  const place = (deltaSec: number): void => {
    const { moved, headings, onFoot } = clock
    const playerAt = player?.position ?? null
    // Citizens come first in the trips, so by the time a vehicle moves this holds them all.
    onFoot.length = 0
    kinds.forEach((kind, kindIndex) => {
      const mesh = meshesRef.current[kindIndex]
      const nose =
        kind.kind === 'citizen'
          ? null
          : { others: onFoot, reach: NOSE_M[kind.kind], radius: VEHICLE_HOLD_M }
      kind.members.forEach((index, instance) => {
        const { route, speed } = trips[index]
        if (deltaSec > 0)
          moved[index] = walkedSec({
            route,
            speed,
            walked: moved[index],
            deltaSec,
            player: playerAt,
            ...nose
          })
        const travelled = moved[index] * speed
        const pose = routePose(route, travelled, speed)
        if (!nose && !pose.isIndoors) onFoot.push(pose)
        headings[index] =
          deltaSec > 0
            ? turnToward(headings[index], pose.heading, deltaSec * TURN_PER_SEC)
            : pose.heading
        const bob = nose ? 0 : Math.abs(Math.sin((travelled / STRIDE_M) * Math.PI)) * BOB_M
        scratch.position.set(pose.x, groundHeight(floor, pose) + bob, pose.z)
        scratch.rotation.y = headings[index]
        // Gone indoors: there, but nothing of it drawn.
        scratch.scale.setScalar(pose.isIndoors ? 0 : 1)
        scratch.updateMatrix()
        mesh?.setMatrixAt(instance, scratch.matrix)
      })
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    })
  }

  // Placed on every commit: under reduced motion this is where they stay, where their loops start.
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
