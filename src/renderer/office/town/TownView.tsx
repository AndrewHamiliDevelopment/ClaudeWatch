import { useMemo } from 'react'
import type { ThemeZoneGroup } from '../logic/office-themes'
import { boundsOfZone } from '../logic/zone-framing'
import { BatchedScene } from '../scene/BatchedScene'
import type { FloorGeometry } from '../scene-model'
import { LotFill } from '../themes/LotFill'
import { thinnedLots } from '../themes/lot-thinning'
import { getTheme } from '../themes/registry'
import { GROUND_Y, lotBase } from '../themes/surroundings'
import type { OfficeTheme } from '../themes/types'
import { fallbackDress } from './fallback-dress'
import { placeGardenPiece } from './garden-pieces'
import { dressLot, type TownDress } from './town-dress'
import type { TownLot } from './town-lots'
import type { TownPlan } from './town-plan'
import type { Town } from './use-town-plan'

// A theme's own town, or one made from its palette until it has drawn one.
export function dressOf(theme: OfficeTheme): TownDress {
  return theme.town ?? fallbackDress(theme.palette)
}

// Where the floor theme's tower stands. The world layer draws this lot, in every zoom band.
export function townLandmark(plan: TownPlan): TownLot | undefined {
  return plan.lots.find((lot) => lot.zone === 'civic' && lot.isLandmark)
}

interface TownProps {
  town: Town
  floor: FloorGeometry
  // Dresses every lot and plot that no company owns.
  floorTheme: OfficeTheme
  zoneGroups: readonly ThemeZoneGroup[]
}

type ThemeFinder = (lot: { id: string; zoneId: string | null }) => string

// The theme of whoever owns a lot or a plot of the belt: its company's, else the floor's.
function themeFinder({ town, floorTheme, zoneGroups }: TownProps): ThemeFinder {
  const themeIdByCompany = new Map(
    zoneGroups.flatMap(({ themeId, companies }) =>
      companies.map((company) => [company.id, themeId] as const)
    )
  )
  return (lot) => {
    const companyId = town.owners.get(lot.id) ?? lot.zoneId
    return (companyId === null ? undefined : themeIdByCompany.get(companyId)) ?? floorTheme.id
  }
}

// Says when the town's lots must be placed again: the claim stepped, the detail level thinned
// them, or a lot changed theme. Never a floor change that moves no claim edge.
function townRevision(props: TownProps, themeIdOf: ThemeFinder): string {
  const { plan } = props.town
  const owned = plan.lots.flatMap((lot) => {
    const themeId = themeIdOf(lot)
    return themeId === props.floorTheme.id ? [] : [`${lot.id}=${themeId}`]
  })
  return JSON.stringify([
    boundsOfZone(plan.claim),
    boundsOfZone(plan.extent),
    plan.lots.length,
    props.floorTheme.id,
    owned
  ])
}

// The buildings of the zoned town and the planted belt round the campus, each merged once.
// The belt has its own batch so that ordinary growth of the plate never rebuilds the town.
export function TownView(props: TownProps) {
  const { town, floor } = props
  const themeIdOf = useMemo(() => themeFinder(props), [town, props.floorTheme, props.zoneGroups])
  const lotsRevision = useMemo(() => townRevision(props, themeIdOf), [themeIdOf])
  const beltRevision = useMemo(
    () =>
      JSON.stringify(
        town.green.map((plot) => [
          plot.id,
          plot.role,
          plot.maxHeight,
          lotBase(plot, floor),
          themeIdOf(plot)
        ])
      ),
    [town.green, floor, themeIdOf]
  )
  // The same elements while a revision stands: an agent's step re-renders the scene, and React
  // must find nothing to do here.
  const lots = useMemo(() => {
    const landmark = townLandmark(town.plan)
    const placed = town.plan.lots
      .filter((lot) => lot !== landmark)
      .map((lot) => dressLot(lot, GROUND_Y, dressOf(getTheme(themeIdOf(lot)))))
    return (
      <BatchedScene revision={lotsRevision} isStatic>
        <LotFill placed={placed} />
      </BatchedScene>
    )
    // `lotsRevision` stands for the plan and for every lot's theme.
  }, [lotsRevision])
  const belt = useMemo(() => {
    const placed = town.green.map((plot) =>
      placeGardenPiece(plot, lotBase(plot, floor), dressOf(getTheme(themeIdOf(plot))))
    )
    return (
      <BatchedScene revision={beltRevision} isStatic>
        <LotFill placed={placed} />
      </BatchedScene>
    )
    // `beltRevision` stands for the plots, where they stand and what dresses them.
  }, [beltRevision])
  return (
    <>
      {lots}
      {belt}
    </>
  )
}

interface TownAmbientProps extends TownProps {
  // The share of its lots a theme may put a mover on; at 0 nothing is mounted.
  share: number
  isReducedMotion: boolean
}

// Each theme's moving things, on the lots that theme dresses. Followed frame by frame, so it is
// kept apart from the buildings, which are placed once.
export function TownAmbient(props: TownAmbientProps) {
  const { town, floor, share, isReducedMotion } = props
  const themeIdOf = useMemo(() => themeFinder(props), [town, props.floorTheme, props.zoneGroups])
  const lotsRevision = useMemo(() => townRevision(props, themeIdOf), [themeIdOf])
  return useMemo(() => {
    const lotsByTheme = Map.groupBy(town.plan.lots, themeIdOf)
    const moving = [...lotsByTheme].flatMap(([themeId, lots]) => {
      const { Ambient } = getTheme(themeId).kit.zone
      return Ambient ? [{ themeId, Ambient, lots: thinnedLots(lots, share, floor) }] : []
    })
    if (share <= 0 || moving.length === 0) return null
    return (
      <BatchedScene revision={JSON.stringify([lotsRevision, share, isReducedMotion])}>
        {moving.map(({ themeId, Ambient, lots }) => (
          <Ambient key={themeId} floor={floor} lots={lots} isReducedMotion={isReducedMotion} />
        ))}
      </BatchedScene>
    )
    // `lotsRevision` stands for the plan and for every lot's theme.
  }, [lotsRevision, floor, share, isReducedMotion])
}
