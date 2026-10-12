import { describe, expect, it } from 'vitest'
import { COURT_CITIZENS } from '../../citizens/figures-court-garrison'
import { violetCourt } from './index'
import { COURT_TOWN } from './town'
import { describeTownDress, heightOf } from './town-dress.test-utils'

describeTownDress(violetCourt, COURT_TOWN)

describe('the Violet Court town', () => {
  const named = (name: string) => COURT_TOWN.designs.find((design) => design.name === name)

  it('keeps the buildings the court already had, each in its zone', () => {
    expect(named('keep')).toMatchObject({ zones: ['civic'], isLandmark: true })
    expect(named('bell-tower')?.zones).toEqual(['civic'])
    expect(named('scholars-colonnade')?.zones).toEqual(['market'])
    expect(named('academy')?.zones).toEqual(['residential'])
    expect(named('frame-hangar')).toMatchObject({ zones: ['workshop'], isLandmark: true })
    expect(named('parterre')?.zones).toEqual(['park'])
    expect(named('opera-hall')).toMatchObject({ zones: ['entertainment'], isLandmark: true })
  })

  it('walks the citizens the court already had', () => {
    expect(COURT_TOWN.citizens).toBe(COURT_CITIZENS)
  })

  it('runs a tall banner coach, a low supply wain and a gilded carriage', () => {
    const byRole = Object.fromEntries(COURT_TOWN.vehicles.map((each) => [each.role, each]))
    expect(byRole.transit.name).toBe('Banner Coach')
    expect(heightOf(byRole.transit)).toBeGreaterThanOrEqual(1.7)
    expect(byRole.freight.name).toBe('Supply Wain')
    expect(heightOf(byRole.freight)).toBeLessThanOrEqual(1.3)
    expect(byRole.runabout.name).toBe('Gilded Carriage')
    expect(heightOf(byRole.runabout)).toBeLessThanOrEqual(1.5)
  })
})
