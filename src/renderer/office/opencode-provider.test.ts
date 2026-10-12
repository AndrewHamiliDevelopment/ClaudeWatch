import { describe, expect, it } from 'vitest'
import { buildTokenLedger, sessionTokens } from '../deck/tokens'
import { buildFixtureFrame } from './fixture/fixture-feed'
import { PROVIDER_LABEL } from './office-palette'
import { listThemes } from './themes/registry'

const COLOUR = /^#[0-9A-F]{6}$/i
const themes = listThemes().map((theme) => [theme.label, theme] as const)

describe('the OpenCode provider in the Office', () => {
  it('is named in the HUD', () => {
    expect(PROVIDER_LABEL.opencode).toBe('OpenCode')
  })

  it.each(themes)('has a skin of its own in %s', (_, theme) => {
    const { claude, codex, opencode } = theme.robot.skins
    expect(opencode.label.trim()).not.toBe('')
    for (const colour of [opencode.body, opencode.trim, opencode.eye])
      expect(colour).toMatch(COLOUR)
    for (const other of [claude, codex]) {
      expect(opencode.label).not.toBe(other.label)
      expect(opencode.body).not.toBe(other.body)
      expect(opencode.eye).not.toBe(other.eye)
    }
  })

  it('goes by a different name in every theme', () => {
    const labels = listThemes().flatMap((theme) => Object.values(theme.robot.skins))
    expect(new Set(labels.map((skin) => skin.label)).size).toBe(labels.length)
  })

  it.each(themes.filter(([, theme]) => theme.roster))(
    'plays a character of the cast in %s',
    (_, theme) => {
      const cast = theme.roster?.entries(null) ?? []
      for (const isSubagent of [false, true]) {
        for (let bay = 0; bay < 12; bay++) {
          const index = theme.roster?.indexFor({ provider: 'opencode', isSubagent }, bay)
          expect(cast[index ?? -1]).toBeDefined()
        }
      }
    }
  )

  it('has one agent in the seeded preview, counted in the Office total', () => {
    const { sessions, agents } = buildFixtureFrame(0, 1_800_000_000_000)
    const opencode = sessions.filter((session) => session.provider === 'opencode')
    expect(opencode).toHaveLength(1)
    expect(agents.some((agent) => agent.agentKey === opencode[0].key)).toBe(true)
    // As the bridge reports it: a running total, no context window, no account.
    expect(opencode[0].usage).toMatchObject({ contextTokens: null, contextLimit: null })
    expect(opencode[0].accountKey ?? null).toBeNull()

    const own = sessionTokens(opencode[0].usage) ?? 0
    expect(own).toBeGreaterThan(0)
    const others = sessions.filter((session) => session.provider !== 'opencode')
    expect(buildTokenLedger(sessions).office).toBe((buildTokenLedger(others).office ?? 0) + own)
  })
})
