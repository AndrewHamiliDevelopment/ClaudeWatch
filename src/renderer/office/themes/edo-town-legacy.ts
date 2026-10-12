import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { ZoneDesign, ZonePlot, ZoneProp } from '../town/town-dress'
import type { TownDistrict } from '../town/town-zones'
import type { LotDesign } from './lot-parts'
import type { PartSpec } from './parts'

function partBounds(parts: readonly PartSpec[]): Box3 {
  return parts.reduce((bounds, part) => {
    const transform = new Matrix4().compose(
      new Vector3(...part.at),
      new Quaternion().setFromEuler(new Euler(...(part.rotation ?? [0, 0, 0]))),
      new Vector3(...part.size)
    )
    return bounds.union(
      new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(transform)
    )
  }, new Box3())
}

// dry-new: legacy lots permit overhanging eaves; zoned lots must contain the entire silhouette.
export function fitTownParts(parts: readonly PartSpec[], plot: ZonePlot): PartSpec[] {
  const bounds = partBounds(parts)
  const span = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const scale = Math.min(1, plot.width / span.x, plot.depth / span.z, plot.height / span.y)
  return parts.map((part) => ({
    ...part,
    at: [
      (part.at[0] - center.x) * scale,
      (part.at[1] - bounds.min.y) * scale,
      (part.at[2] - center.z) * scale
    ],
    size: [part.size[0] * scale, part.size[1] * scale, part.size[2] * scale]
  }))
}

interface LegacyDesign {
  source: LotDesign
  name?: string
  zones: readonly TownDistrict[]
  max: number
  isLandmark?: true
  roof: (part: PartSpec) => boolean
}

export function legacyTownDesign({
  source,
  name,
  zones,
  max,
  isLandmark,
  roof
}: LegacyDesign): ZoneDesign {
  return {
    name: name ?? source.name,
    zones,
    height: { min: source.minHeight, max },
    ...(isLandmark ? { isLandmark } : {}),
    build: (plot) =>
      fitTownParts(
        source.parts(plot).map((part) => (roof(part) ? { ...part, color: plot.accent } : part)),
        plot
      )
  }
}

export function legacyBuilding(buildings: readonly LotDesign[], name: string): LotDesign {
  const building = buildings.find((design) => design.name === name)
  if (!building) throw new Error(`Missing legacy town design: ${name}`)
  return building
}

export function legacyTownProp(source: LotDesign, zones: readonly TownDistrict[]): ZoneProp {
  const parts = source.parts({ width: 1, depth: 0.8, height: 1.6, seed: 0 })
  const bounds = partBounds(parts)
  const span = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  return {
    name: source.name,
    zones,
    size: [span.x, span.y, span.z],
    parts: parts.map((part) => ({
      ...part,
      at: [part.at[0] - center.x, part.at[1] - bounds.min.y, part.at[2] - center.z]
    }))
  }
}

// dry-new: new zoned designs share the same containment rule as adapted legacy lots.
export const townBuilding = (
  name: string,
  zone: ZoneDesign['zones'][number],
  max: number,
  build: ZoneDesign['build'],
  min = 2,
  isLandmark?: true
): ZoneDesign => ({
  name,
  zones: [zone],
  height: { min, max },
  ...(isLandmark ? { isLandmark } : {}),
  build: (plot) => fitTownParts(build(plot), plot)
})
