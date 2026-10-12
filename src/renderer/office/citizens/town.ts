import type { FloorGeometry } from '../scene-model'
import { draw, gapBetween, type Lot } from '../themes/surroundings'
import type { CitizenRoute, RoutePoint } from './route-pose'
import { citizenRoutes } from './routes'

export interface Citizen {
  route: CitizenRoute
  // Whose dress it wears: the theme of the company whose lots are nearest where it starts.
  themeId: string
  // Which of that theme's figures it is.
  figure: number
  // Metres a second.
  speed: number
}

// One instanced draw per kind of figure in town, and no more than this many kinds.
export const MAX_CITIZEN_DRAWS = 6
const FIGURES_PER_THEME = 4
const STROLL_M_PER_SEC = { min: 0.6, max: 1.2 }

// How many of its figures each theme shows, so that every theme in town fits the draw budget.
export function figureSlots(themeCount: number): number {
  return Math.max(1, Math.min(FIGURES_PER_THEME, Math.floor(MAX_CITIZEN_DRAWS / themeCount)))
}

function nearestLot(lots: readonly Lot[], point: RoutePoint): Lot | null {
  if (lots.length === 0) return null
  const here = { ...point, width: 0, depth: 0 }
  return lots.reduce((best, lot) => (gapBetween(lot, here) < gapBetween(best, here) ? lot : best))
}

interface Town {
  floor: FloorGeometry
  // Everything the streets were laid round: the same list Streets is drawn from.
  lots: readonly Lot[]
  floorThemeId: string
  // A company zone's id to its theme. A lot of no company in it belongs to the floor's theme.
  themeIdByZone: ReadonlyMap<string, string>
  share?: number
}

export function townCitizens({ floor, lots, floorThemeId, themeIdByZone, share }: Town): Citizen[] {
  const routes = citizenRoutes(floor, lots, share)
  // The district's own lots stand between every street and the offices: only a company's count.
  const companyIds = new Set(floor.zones.map((zone) => zone.id))
  const owned = lots.filter((lot) => lot.zoneId !== null && companyIds.has(lot.zoneId))
  const owners = routes.map(
    (route) => themeIdByZone.get(nearestLot(owned, route.points[0])?.zoneId ?? '') ?? floorThemeId
  )
  // Past the budget a theme has no draw left: its streets get the floor's townsfolk.
  const drawn = [...new Set([floorThemeId, ...owners])].slice(0, MAX_CITIZEN_DRAWS)
  const slots = figureSlots(drawn.length)
  const countByTheme = new Map<string, number>()
  return routes.map((route, index) => {
    const themeId = drawn.includes(owners[index]) ? owners[index] : floorThemeId
    const rank = countByTheme.get(themeId) ?? 0
    countByTheme.set(themeId, rank + 1)
    const { min, max } = STROLL_M_PER_SEC
    return { route, themeId, figure: rank % slots, speed: min + (max - min) * draw(index, 0) }
  })
}

export interface CitizenKind {
  key: string
  themeId: string
  figure: number
  // Indices into the town's citizens: one instance each, in this order.
  members: number[]
}

// The citizens that share a figure, and so one draw.
export function citizenKinds(citizens: readonly Citizen[]): CitizenKind[] {
  const kinds = new Map<string, CitizenKind>()
  citizens.forEach(({ themeId, figure }, index) => {
    const key = `${themeId}:${figure}`
    const kind = kinds.get(key) ?? { key, themeId, figure, members: [] }
    kind.members.push(index)
    kinds.set(key, kind)
  })
  return [...kinds.values()]
}
