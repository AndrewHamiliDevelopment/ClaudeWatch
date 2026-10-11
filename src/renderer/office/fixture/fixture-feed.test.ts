import { beforeEach, describe, expect, it } from 'vitest'
import { sessionTokens } from '../../deck/roster'
import { officeThemes } from '../logic/office-themes'
import { buildFixtureFrame, createFixtureFeed } from './fixture-feed'

const frame = buildFixtureFrame(0, 1_000_000)

describe('seeded preview sessions', () => {
  it('carries usage in the hundreds of millions for most sessions', () => {
    const totals = frame.sessions.flatMap((session) => sessionTokens(session.usage) ?? [])
    expect(totals.length).toBeGreaterThan(frame.sessions.length / 2)
    for (const total of totals) {
      expect(total).toBeGreaterThanOrEqual(50_000_000)
      expect(total).toBeLessThan(2_000_000_000)
    }
  })

  it('leaves one session uncounted, the way a first scan arrives', () => {
    expect(frame.sessions.some((session) => session.usage === null)).toBe(true)
  })

  it('knows the window size only for Codex', () => {
    for (const session of frame.sessions) {
      if (!session.usage) continue
      expect(session.usage.contextLimit !== null).toBe(session.provider === 'codex')
    }
  })

  it('keeps usage growing from one tick to the next', () => {
    const later = buildFixtureFrame(5, 1_010_000)
    const before = sessionTokens(frame.sessions[1].usage) ?? 0
    expect(sessionTokens(later.sessions[1].usage)).toBeGreaterThan(before)
  })

  it('has a lead with two named teammates, each with a pane and tokens of its own', () => {
    const lead = frame.sessions.find(
      (session) => session.subagents.filter((member) => member.kind === 'teammate').length === 2
    )
    expect(lead).toBeDefined()
    const teammates = lead?.subagents.filter((member) => member.kind === 'teammate') ?? []
    for (const teammate of teammates) {
      expect(teammate.name).toBeTruthy()
      expect(teammate.orcaPaneKey).toBeTruthy()
      expect(teammate.tokens).toBeTruthy()
      expect(frame.agents.some((agent) => agent.agentKey === `${lead?.key}#${teammate.id}`)).toBe(
        true
      )
    }
  })
})

describe('createFixtureFeed', () => {
  beforeEach(() => localStorage.clear())

  it('puts two companies on different themes so the picker has something to show', () => {
    createFixtureFeed()
    const [first, second] = frame.floors[0].zones
    const themeOf = (companyKey: string | null): string =>
      officeThemes.getAssignments().companies[companyKey ?? ''] ?? 'default'
    expect(themeOf(first.companyKey)).not.toBe(themeOf(second.companyKey))
  })

  it('answers a focus request so the preview can show where it landed', async () => {
    const feed = createFixtureFeed()
    await expect(feed.focus?.('claude:claudewatch-0')).resolves.toMatchObject({ target: 'pane' })
    await expect(feed.focus?.('codex:claudewatch-1')).resolves.toMatchObject({
      success: false,
      target: 'app'
    })
  })
})
