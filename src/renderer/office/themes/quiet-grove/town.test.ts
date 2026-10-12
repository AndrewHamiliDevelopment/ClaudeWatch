import { describe, expect, it } from 'vitest'
import { citizenFigures } from '../../citizens/figures'
import { describeTownDress, heightOf } from '../violet-court/town-dress.test-utils'
import { quietGrove } from './index'
import { GROVE } from './palette'
import { QUIET_GROVE_ID } from './roster'
import { GROVE_TOWN } from './town'

describeTownDress(quietGrove, GROVE_TOWN)

describe('the Quiet Grove town', () => {
  const named = (name: string) => GROVE_TOWN.designs.find((design) => design.name === name)

  it('keeps the buildings the grove already had, each in its zone', () => {
    expect(named('watchtower')).toMatchObject({ zones: ['civic'], isLandmark: true })
    expect(named('greenhouse-stall')?.zones).toEqual(['market'])
    expect(named('cabin')?.zones).toEqual(['residential'])
    expect(named('watermill')).toMatchObject({ zones: ['workshop'], isLandmark: true })
    for (const park of ['pond', 'rock-garden', 'pine-stand', 'great-tree'])
      expect(named(park)?.zones, park).toEqual(['park'])
    expect(named('festival-green')).toMatchObject({ zones: ['entertainment'], isLandmark: true })
  })

  it('walks the citizens the grove already had', () => {
    expect(GROVE_TOWN.citizens).toBe(citizenFigures(QUIET_GROVE_ID))
  })

  it('keeps the needs-you pink out of the town', () => {
    const colors = [
      ...Object.values(GROVE_TOWN.looks).flatMap((look) => [look.accent, look.ground]),
      ...Object.values(GROVE_TOWN.roads),
      ...GROVE_TOWN.vehicles.flatMap((vehicle) => vehicle.parts().map((part) => part.color))
    ]
    expect(colors.map((color) => color.toUpperCase())).not.toContain(GROVE.beacon.toUpperCase())
  })

  it('runs a pony trap, a low timber wagon and a barrow pushed on foot', () => {
    const byRole = Object.fromEntries(GROVE_TOWN.vehicles.map((each) => [each.role, each]))
    expect(byRole.transit.name).toBe('Pony Trap')
    expect(heightOf(byRole.transit)).toBeGreaterThanOrEqual(1.3)
    expect(byRole.freight.name).toBe('Timber Wagon')
    expect(heightOf(byRole.freight)).toBeLessThanOrEqual(1.3)
    expect(byRole.runabout.name).toBe('Garden Barrow')
    expect(heightOf(byRole.runabout)).toBeLessThanOrEqual(1.2)
  })
})
