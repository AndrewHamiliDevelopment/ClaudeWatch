import type { ZoneDesign, ZonePlot, ZoneProp } from '../town/town-dress'
import type { TownDistrict } from '../town/town-zones'
import type { BuildingDesign, PropDesign } from './lot-kit'
import type { PartSpec } from './parts'

// How one of a theme's own lot buildings joins the zoned town.
export interface Restyle {
  name?: string
  zones: readonly TownDistrict[]
  // Its roof or its canopy: those parts take the zone's accent instead.
  isRoof?: (part: PartSpec) => boolean
  // What the town adds to it, the accent among it.
  extra?: (plot: ZonePlot) => PartSpec[]
  height?: ZoneDesign['height']
  // The share of the plot it is built on, where its edges would overhang a small one.
  share?: number
  isLandmark?: true
}

export const paintedIn =
  (color: string) =>
  (part: PartSpec): boolean =>
    part.color === color

// The buildings a theme already had, tagged by zone and roofed in their zone's colour.
export function heritageDesigns(
  buildings: readonly BuildingDesign[],
  restyles: Readonly<Record<string, Restyle | undefined>>
): ZoneDesign[] {
  return buildings.flatMap((design) => {
    const restyle = restyles[design.name]
    if (!restyle) return []
    const { isRoof, extra, share = 1, ...tags } = restyle
    const build = (plot: ZonePlot): PartSpec[] => [
      ...design
        .build({ ...plot, width: plot.width * share, depth: plot.depth * share })
        .map((part) => (isRoof?.(part) ? { ...part, color: plot.accent } : part)),
      ...(extra?.(plot) ?? [])
    ]
    return [{ ...design, ...tags, build }]
  })
}

// A theme's wall-side props, each tagged with the zones it belongs in.
export function zonedProps(
  props: readonly PropDesign[],
  zonesByName: Readonly<Record<string, readonly TownDistrict[] | undefined>>
): ZoneProp[] {
  return props.map((prop) => ({ ...prop, zones: zonesByName[prop.name] ?? [] }))
}
