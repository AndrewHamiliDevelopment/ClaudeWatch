import { describe, expect, it } from 'vitest'
import {
  TOWN_DISTRICTS,
  ZONE_HEIGHT_CAP_M,
  blockOfCell,
  zoneHeightCap,
  zoneOfBlock
} from './town-zones'

const COLUMNS = Array.from({ length: 41 }, (_, index) => index - 20)
const ROWS = Array.from({ length: 41 }, (_, index) => index - 20)
const BLOCKS = COLUMNS.flatMap((column) => ROWS.map((row) => ({ column, row })))

describe('zoneOfBlock', () => {
  it('puts civic on the two gate-plaza blocks, either side of the avenue', () => {
    expect(zoneOfBlock(-2, -1)).toBe('civic')
    expect(zoneOfBlock(-2, 0)).toBe('civic')
  })

  it('lines the avenue with the market west of the plaza', () => {
    for (const column of [-3, -4, -9])
      for (const row of [-1, 0]) expect(zoneOfBlock(column, row)).toBe('market')
  })

  it('never turns a civic or a market block into a park', () => {
    for (const { column, row } of BLOCKS.filter((block) => block.row === -1 || block.row === 0))
      if (column <= -2) expect(zoneOfBlock(column, row)).not.toBe('park')
  })

  it.each([
    ['entertainment south-west of the gate', (c: number, r: number) => c <= -2 && r >= 1],
    ['residential north-west of the gate', (c: number, r: number) => c <= -2 && r <= -2],
    ['residential on the north flank', (c: number, r: number) => c >= -1 && r <= -1],
    ['workshop on the south flank', (c: number, r: number) => c >= -1 && r >= 0]
  ])('puts %s, but for its parks', (name, isInSector) => {
    const zones = BLOCKS.filter(({ column, row }) => isInSector(column, row)).map(
      ({ column, row }) => zoneOfBlock(column, row)
    )
    expect(new Set(zones)).toEqual(new Set([name.split(' ')[0], 'park']))
  })

  it('turns about one block in eight into a park', () => {
    const open = BLOCKS.filter(({ column, row }) => column > -2 || (row !== -1 && row !== 0))
    const parks = open.filter(({ column, row }) => zoneOfBlock(column, row) === 'park')
    const share = parks.length / open.length
    expect(share).toBeGreaterThan(0.09)
    expect(share).toBeLessThan(0.16)
  })

  it('gives a block the same zone every time', () => {
    for (const { column, row } of BLOCKS)
      expect(zoneOfBlock(column, row)).toBe(zoneOfBlock(column, row))
  })
})

describe('blockOfCell', () => {
  it('pairs lot cells into blocks, on the negative side too', () => {
    expect(blockOfCell(0, 1)).toEqual({ column: 0, row: 0 })
    expect(blockOfCell(2, 3)).toEqual({ column: 1, row: 1 })
    expect(blockOfCell(-1, -2)).toEqual({ column: -1, row: -1 })
    expect(blockOfCell(-3, -4)).toEqual({ column: -2, row: -2 })
  })
})

describe('the zone height caps', () => {
  it('cap every district, the market lowest of the built ones and civic highest', () => {
    for (const zone of TOWN_DISTRICTS) expect(ZONE_HEIGHT_CAP_M[zone]).toBeGreaterThan(0)
    const built = TOWN_DISTRICTS.filter((zone) => zone !== 'park')
    expect(Math.min(...built.map((zone) => ZONE_HEIGHT_CAP_M[zone]))).toBe(ZONE_HEIGHT_CAP_M.market)
    expect(Math.max(...built.map((zone) => ZONE_HEIGHT_CAP_M[zone]))).toBe(ZONE_HEIGHT_CAP_M.civic)
  })

  it('lets a built zone rise to twice its cap in the far ring, and never past 24 m', () => {
    for (const zone of TOWN_DISTRICTS)
      expect(zoneHeightCap(zone, false)).toBe(ZONE_HEIGHT_CAP_M[zone])
    expect(zoneHeightCap('residential', true)).toBe(ZONE_HEIGHT_CAP_M.residential * 2)
    expect(zoneHeightCap('market', true)).toBe(ZONE_HEIGHT_CAP_M.market * 2)
    expect(zoneHeightCap('workshop', true)).toBe(24)
    expect(zoneHeightCap('civic', true)).toBe(24)
  })

  it('keeps a park low wherever it is: its walkers must be seen', () => {
    expect(zoneHeightCap('park', true)).toBe(ZONE_HEIGHT_CAP_M.park)
  })
})
