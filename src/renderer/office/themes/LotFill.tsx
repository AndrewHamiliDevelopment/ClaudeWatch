import { useMemo } from 'react'
import type { WallSide } from '../logic/room-layout'
import type { FloorGeometry } from '../scene-model'
import { apronBand, apronLots, type ApronLot, type ApronPlan, type ApronRow } from './apron'
import { placeLot, type LotKit, type PlacedGroup } from './lot-kit'
import { box, Parts } from './parts'
import { GROUND_Y, type Lot } from './surroundings'

// Every lot's building or prop, as unit parts that merge into a draw per shape and colour.
export function LotFill({ placed }: { placed: readonly PlacedGroup[] }) {
  return (
    <>
      {placed.map(({ key, at, turn, scale, parts }) => (
        <group key={key} position={at} rotation={[0, turn, 0]} scale={scale}>
          <Parts parts={parts} />
        </group>
      ))}
    </>
  )
}

export function KitFill({
  lots,
  floor,
  kit
}: {
  lots: readonly Lot[]
  floor: FloorGeometry
  kit: LotKit
}) {
  const placed = useMemo(() => lots.map((lot) => placeLot(lot, floor, kit)), [lots, floor, kit])
  return <LotFill placed={placed} />
}

const CELL_M = 5.5
const TERRACE_THICKNESS_M = 0.08
const terraceRow = (row: number, reach: ApronRow['reach']): ApronRow => ({
  kind: 'building',
  out: 1 + (row + 0.5) * CELL_M,
  along: { min: 4, max: 4.9 },
  across: { min: 4, max: 4.9 },
  pitch: CELL_M,
  reach
})
// Terraces of square lots, low by the plate and taller out: three deep to the north, one south.
const TERRACE_APRON: ApronPlan = {
  north: [0, 1, 2].map((row) => terraceRow(row, 'plate')),
  south: [terraceRow(0, 'plate')],
  west: [0, 1].map((row) => terraceRow(row, 'apron')),
  east: [0, 1].map((row) => terraceRow(row, 'apron'))
}

export function terraceLots(floor: FloorGeometry, sides: readonly WallSide[]): ApronLot[] {
  return apronLots(floor, TERRACE_APRON).filter((lot) => sides.includes(lot.side))
}

// The floor theme's share of the apron: paving on the given sides and a building on every lot.
export function ApronFill({
  floor,
  kit,
  sides,
  paving
}: {
  floor: FloorGeometry
  kit: LotKit
  sides: readonly WallSide[]
  paving: string
}) {
  const lots = useMemo(() => terraceLots(floor, sides), [floor, sides])
  const terraces = sides.map((side) => {
    const band = apronBand(floor, side)
    return box(
      [band.x, GROUND_Y + TERRACE_THICKNESS_M / 2, band.z],
      [band.width, TERRACE_THICKNESS_M, band.depth],
      paving
    )
  })
  return (
    <>
      <Parts parts={terraces} />
      <KitFill lots={lots} floor={floor} kit={kit} />
    </>
  )
}

// The district fills three sides; the hangar stands on the fourth and fills that one.
export const DISTRICT_SIDES: readonly WallSide[] = ['west', 'north', 'south']
export const HANGAR_SIDES: readonly WallSide[] = ['east']
