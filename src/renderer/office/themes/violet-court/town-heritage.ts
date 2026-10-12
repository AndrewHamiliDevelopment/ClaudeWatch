import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import type { TownDistrict } from '../../town/town-zones'
import { box, SIDES, type PartSpec } from '../parts'
import { COURT_BUILDINGS } from './court-buildings'
import { COURT } from './palette'

// How one of the court's own buildings joins the zoned town.
interface Restyle {
  name?: string
  zones: readonly TownDistrict[]
  // The colour its roof was drawn in: those parts take the zone's accent instead.
  roof?: string
  // What the town adds to it, the accent among it.
  extra?: (plot: ZonePlot) => PartSpec[]
  height?: ZoneDesign['height']
  isLandmark?: true
}

// Counters between the columns, each with a row of books.
function scholarStalls({ width, depth }: ZonePlot): PartSpec[] {
  return SIDES.flatMap((side) => [
    box([side * width * 0.28, 0.45, 0], [width * 0.2, 0.5, depth * 0.24], COURT.slate),
    box([side * width * 0.28, 0.74, 0], [width * 0.16, 0.08, depth * 0.12], COURT.crimson),
    box([side * width * 0.28, 0.82, 0], [width * 0.1, 0.08, depth * 0.1], COURT.ivory)
  ])
}

// A cloth roof over the back of the gantry: the front stays open so the frame is seen.
const hangarCanopy = ({ width, depth, height, accent }: ZonePlot): PartSpec[] => [
  box([0, height - 0.015, -depth * 0.2], [width * 0.96, 0.03, depth * 0.4], accent)
]

const RESTYLES: Record<string, Restyle | undefined> = {
  parterre: { zones: ['park'], roof: COURT.violet },
  colonnade: {
    name: 'scholars-colonnade',
    zones: ['market'],
    roof: COURT.ink,
    extra: scholarStalls
  },
  // Taller than the gantry was built: a frame the height of a tower is what marks the yard.
  'frame-hangar': {
    zones: ['workshop'],
    extra: hangarCanopy,
    height: { min: 2.6, max: 10 },
    isLandmark: true
  },
  academy: { zones: ['residential'], roof: COURT.ink },
  'bell-tower': { zones: ['civic'], roof: COURT.violet },
  keep: { zones: ['civic'], roof: COURT.violet, isLandmark: true }
}

// The buildings the court already had, tagged by zone and roofed in their zone's colour.
export const COURT_HERITAGE: readonly ZoneDesign[] = COURT_BUILDINGS.flatMap((design) => {
  const restyle = RESTYLES[design.name]
  if (!restyle) return []
  const { roof, extra, ...tags } = restyle
  const build = (plot: ZonePlot): PartSpec[] => [
    ...design
      .build(plot)
      .map((part) => (part.color === roof ? { ...part, color: plot.accent } : part)),
    ...(extra?.(plot) ?? [])
  ]
  return [{ ...design, ...tags, build }]
})
