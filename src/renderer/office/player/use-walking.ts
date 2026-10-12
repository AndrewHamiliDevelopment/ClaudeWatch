import { useCallback, useMemo, type Dispatch } from 'react'
import type { OfficeAction } from '../logic/office-reducer'
import { findZone } from '../logic/zone-model'
import type { FloorGeometry } from '../scene-model'
import { doorstep } from './walk-ground'
import { createPlayer, sendPlayer } from './walking'

// The owner's player for the floor on show. It is made at the gate when the Office opens and
// lives only in this page: the bridge never hears of it, so a view-only page has one too.
export function useWalking(
  floor: FloorGeometry | undefined,
  isWalking: boolean,
  dispatch: Dispatch<OfficeAction>
) {
  const floorId = floor?.floorId
  const gateX = floor?.elevator.x
  const gateZ = floor?.elevator.z
  const player = useMemo(
    () =>
      gateX === undefined || gateZ === undefined ? null : createPlayer({ x: gateX, z: gateZ }),
    // The feed rebuilds the floor on every frame; the player lasts as long as its floor does.
    [floorId]
  )
  // Choosing an office: walking sends the player to its door, otherwise the camera flies there.
  const goToZone = useCallback(
    (zoneId: string) => {
      const zone = floor ? findZone(floor, zoneId) : undefined
      if (!isWalking || !player || !zone) return dispatch({ type: 'zone-flown', zoneId })
      sendPlayer(player, zone.door ? doorstep({ ...zone, door: zone.door }) : zone)
      dispatch({ type: 'zone-walked', zoneId })
    },
    [floor, isWalking, player, dispatch]
  )
  return { player, goToZone }
}
