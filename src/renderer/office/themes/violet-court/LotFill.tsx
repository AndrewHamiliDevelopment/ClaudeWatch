import { useMemo } from 'react'
import type { WallSide } from '../../logic/room-layout'
import type { FloorGeometry } from '../../scene-model'
import { Parts } from '../parts'
import type { Lot } from '../surroundings'
import { apronLots, apronTerrace } from './apron'
import { placeLot, type LotKit } from './lot-kit'

// Every lot's building or prop, as unit parts that merge into a draw per shape and colour.
export function LotFill({
  lots,
  floor,
  kit
}: {
  lots: readonly Lot[]
  floor: FloorGeometry
  kit: LotKit
}) {
  const placed = useMemo(() => lots.map((lot) => placeLot(lot, floor, kit)), [lots, floor, kit])
  return (
    <>
      {placed.map(({ lot, at, turn, scale, parts }) => (
        <group key={lot.id} position={at} rotation={[0, turn, 0]} scale={scale}>
          <Parts parts={parts} />
        </group>
      ))}
    </>
  )
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
  const lots = useMemo(
    () => apronLots(floor).filter((lot) => sides.includes(lot.side)),
    [floor, sides]
  )
  return (
    <>
      <Parts parts={sides.map((side) => apronTerrace(floor, side, paving))} />
      <LotFill lots={lots} floor={floor} kit={kit} />
    </>
  )
}

// The district fills three sides; the hangar stands on the fourth and fills that one.
export const DISTRICT_SIDES: readonly WallSide[] = ['west', 'north', 'south']
export const HANGAR_SIDES: readonly WallSide[] = ['east']
