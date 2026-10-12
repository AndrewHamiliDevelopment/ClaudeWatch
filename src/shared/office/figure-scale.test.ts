import { expect, it } from 'vitest'
import {
  AGENT_SCALE,
  CITIZEN_SCALE,
  FURNITURE_SCALE,
  GUEST_FURNITURE_SCALE,
  SUBAGENT_SCALE
} from './figure-scale'

it('makes agents the largest figures, and a subagent larger than a citizen', () => {
  expect([AGENT_SCALE, SUBAGENT_SCALE, CITIZEN_SCALE]).toEqual([1.65, 1.4, 1.3])
  expect(AGENT_SCALE).toBeGreaterThan(SUBAGENT_SCALE)
  expect(SUBAGENT_SCALE).toBeGreaterThan(CITIZEN_SCALE)
})

it('grows furniture by as much as the figure that uses it grew from 1.3', () => {
  expect(FURNITURE_SCALE).toBeCloseTo(1.65 / 1.3, 12)
  expect(GUEST_FURNITURE_SCALE).toBeCloseTo(1.4 / 1.3, 12)
  // A desk drawn for a 1.3 figure, scaled, is as large against its agent as it was.
  expect(AGENT_SCALE / FURNITURE_SCALE).toBeCloseTo(SUBAGENT_SCALE / GUEST_FURNITURE_SCALE, 12)
})
