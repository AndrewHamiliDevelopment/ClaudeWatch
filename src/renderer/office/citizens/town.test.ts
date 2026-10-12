import { describe, expect, it } from 'vitest'
import { districtLots } from '../player/district-lots'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { DEFAULT_THEME_ID } from '../themes/registry'
import { gapBetween, surroundingLots, type Lot } from '../themes/surroundings'
import { VIOLET_COURT_ID } from '../themes/violet-court/roster'
import { figureSlots, MAX_CITIZEN_DRAWS, townCitizens } from './town'

const [, floor] = LIVE_FLOORS[1]
const lots = [...surroundingLots(floor), ...districtLots(DEFAULT_THEME_ID, floor)]
const [, court] = floor.zones
const themeIdByZone = new Map([[court.id, VIOLET_COURT_ID]])
const town = { floor, lots, floorThemeId: DEFAULT_THEME_ID, themeIdByZone }

// The nearest lot that belongs to a company: the district's own lots belong to none.
function nearestLot(point: { x: number; z: number }): Lot {
  const here = { ...point, width: 0, depth: 0 }
  const companyIds = floor.zones.map((zone) => zone.id)
  const owned = lots.filter((lot) => lot.zoneId !== null && companyIds.includes(lot.zoneId))
  return owned.reduce((best, lot) => (gapBetween(lot, here) < gapBetween(best, here) ? lot : best))
}

describe('figureSlots', () => {
  it('shows every figure of a lone theme and fewer of each as themes share the town', () => {
    expect([1, 2, 3, 4, 5, 6].map(figureSlots)).toEqual([4, 3, 2, 1, 1, 1])
  })
})

describe('townCitizens', () => {
  const citizens = townCitizens(town)

  it('dresses a citizen in the theme of the company whose lots are nearest where it starts', () => {
    for (const citizen of citizens) {
      const owner = nearestLot(citizen.route.points[0]).zoneId
      expect(citizen.themeId).toBe(owner === court.id ? VIOLET_COURT_ID : DEFAULT_THEME_ID)
    }
  })

  it('gives a two-theme town both kinds of townsfolk', () => {
    const themeIds = new Set(citizens.map((citizen) => citizen.themeId))
    expect([...themeIds].sort()).toEqual([DEFAULT_THEME_ID, VIOLET_COURT_ID].sort())
    const courtiers = citizens.filter((citizen) => citizen.themeId === VIOLET_COURT_ID)
    expect(courtiers.length).toBeGreaterThanOrEqual(citizens.length / 4)
    expect(courtiers.length).toBeLessThanOrEqual((citizens.length * 3) / 4)
  })

  it('shares each theme out over its figures', () => {
    for (const themeId of [DEFAULT_THEME_ID, VIOLET_COURT_ID]) {
      const figures = citizens.filter((one) => one.themeId === themeId).map((one) => one.figure)
      expect(Math.max(...figures)).toBeLessThan(figureSlots(2))
      expect(new Set(figures).size).toBeGreaterThan(1)
    }
  })

  it('walks at a stroll, each at its own pace', () => {
    for (const citizen of citizens) {
      expect(citizen.speed).toBeGreaterThanOrEqual(0.6)
      expect(citizen.speed).toBeLessThanOrEqual(1.2)
    }
    expect(new Set(citizens.map((citizen) => citizen.speed)).size).toBeGreaterThan(1)
  })

  it('gives the same town the same citizens', () => {
    expect(townCitizens({ ...town, lots: [...lots] })).toEqual(citizens)
  })

  it('never needs more kinds than the draw budget, however many themes share the town', () => {
    const zoned = lots.map((lot, index) => ({ ...lot, zoneId: `zone-${index % 9}` }))
    const zones = Array.from({ length: 9 }, (_, index) => ({
      ...floor.zones[index % floor.zones.length],
      id: `zone-${index}`
    }))
    const crowded = townCitizens({
      ...town,
      floor: { ...floor, zones },
      lots: zoned,
      themeIdByZone: new Map(zoned.map((lot, index) => [lot.zoneId, `theme-${index % 9}`]))
    })
    const kinds = new Set(crowded.map((one) => `${one.themeId}:${one.figure}`))
    expect(new Set(crowded.map((one) => one.themeId)).size).toBeGreaterThan(1)
    expect(kinds.size).toBeLessThanOrEqual(MAX_CITIZEN_DRAWS)
  })
})
