import { describe, expect, it } from 'vitest'
import { limitScopeName, planName } from './display-names'

describe('planName', () => {
  it.each([
    ['default_claude_max_20x', 'Max 20x'],
    ['default_claude_max_5x', 'Max 5x'],
    ['max', 'Max'],
    ['pro', 'Pro'],
    ['team', 'Team'],
    ['enterprise', 'Enterprise']
  ])('calls %s %s', (id, name) => {
    expect(planName(id)).toBe(name)
  })

  it.each([
    ['default_claude_ai', 'AI'],
    ['default_raven', 'Raven'],
    ['claude_team-premium', 'Team premium'],
    ['enterprise_usage_based', 'Enterprise usage based']
  ])('tidies an id it does not know, %s, into %s', (id, name) => {
    expect(planName(id)).toBe(name)
  })

  it.each(['default_claude_', 'default', '__', 'x'.repeat(300)])(
    'never answers nothing, even for %s',
    (id) => {
      expect(planName(id)).toMatch(/\S/)
      expect(planName(id).length).toBeLessThanOrEqual(40)
    }
  )

  it('lets no markup or line break through from an id on disk', () => {
    expect(planName('max\n<b>20x</b>')).toBe('Max b 20x b')
  })
})

describe('limitScopeName', () => {
  it.each([
    ['fableWeekly', 'Fable'],
    ['weeklyOpus', 'Opus'],
    ['seven_day_sonnet', 'Sonnet'],
    ['opusSession', 'Opus'],
    ['codeReviewWeekly', 'Code review']
  ])('names the model family in %s: %s', (scope, name) => {
    expect(limitScopeName(scope)).toBe(name)
  })

  it('never answers nothing when a scope only restates its window', () => {
    expect(limitScopeName('sevenDay')).toBe('Seven day')
  })
})
