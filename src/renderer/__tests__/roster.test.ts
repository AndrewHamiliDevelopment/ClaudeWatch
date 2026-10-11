import { describe, expect, it } from 'vitest'
import { buildSquads, crestFor, filterSquads, stateOfAttention, tallySquads } from '../deck/roster'
import { sessionTokens } from '../deck/tokens'
import { instanceFixture, NOW_MS, sessionFixture } from './fixtures'

describe('crestFor', () => {
  it.each([
    ['ClaudeWatch', 'CW'],
    ['PropApp', 'PA'],
    ['CrownOS', 'CO'],
    ['zkidz-claude-team', 'ZT'],
    ['api', 'AP'],
    ['x', 'X']
  ])('abbreviates %s to %s', (projectName, crest) => {
    expect(crestFor(projectName)).toBe(crest)
  })
})

describe('sessionTokens', () => {
  it('sums all four counts of the session and the agents it spawned', () => {
    const tokens = sessionTokens({
      own: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 },
      subagents: { input: 10, output: 20, cacheWrite: 30, cacheRead: 40 },
      spawned: 2,
      contextTokens: null,
      contextLimit: null
    })
    expect(tokens).toBe(110)
  })

  it('is null, never zero, when usage has not been counted', () => {
    expect(sessionTokens(null)).toBeNull()
    expect(sessionTokens(undefined)).toBeNull()
  })
})

const usageOf = (tokens: number) => ({
  own: { input: tokens, output: 0, cacheWrite: 0, cacheRead: 0 },
  subagents: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  spawned: 0,
  contextTokens: null,
  contextLimit: null
})

describe('buildSquads', () => {
  it('groups agents by project and names the squad after the project folder', () => {
    const squads = buildSquads(
      [
        instanceFixture({ pid: 1 }),
        instanceFixture({ pid: 2 }),
        instanceFixture({
          pid: 3,
          projectPath: '/Users/test/Client/PropApp',
          projectName: 'Client/PropApp'
        })
      ],
      null,
      NOW_MS
    )

    expect(squads.map((squad) => [squad.name, squad.company, squad.agents.length])).toEqual([
      ['ClaudeWatch', 'ZKidz', 2],
      ['PropApp', 'Client', 1]
    ])
    expect(squads[0].crest).toBe('CW')
  })

  it('gives two projects with the same initials different crests', () => {
    const squads = buildSquads(
      [
        instanceFixture({ pid: 1 }),
        instanceFixture({
          pid: 2,
          projectPath: '/Users/test/ZKidz/ClearSpent-Web',
          projectName: 'ZKidz/ClearSpent-Web'
        }),
        instanceFixture({
          pid: 3,
          projectPath: '/Users/test/ZKidz/CrabWalk',
          projectName: 'ZKidz/CrabWalk'
        })
      ],
      null,
      NOW_MS
    )

    expect(squads.map((squad) => [squad.name, squad.crest])).toEqual([
      ['ClaudeWatch', 'CW'],
      ['ClearSpent-Web', 'CS'],
      ['CrabWalk', 'CR']
    ])
  })

  it('totals a squad from every session of its project, a Codex one included', () => {
    const [squad] = buildSquads(
      [instanceFixture({ pid: 1234 })],
      [
        sessionFixture({ pid: 1234, usage: usageOf(100) }),
        // The process list only knows Claude processes; the feed knows this one.
        sessionFixture({ key: 'codex:c1', provider: 'codex', pid: 999, usage: usageOf(50) })
      ],
      NOW_MS
    )
    expect(squad.tokens).toBe(150)
    expect(squad.isTokensPartial).toBe(false)
  })

  it('says a total is partial while one of its sessions is still being counted', () => {
    const [squad] = buildSquads(
      [instanceFixture({ pid: 1234 }), instanceFixture({ pid: 77 })],
      [
        sessionFixture({ pid: 1234, usage: usageOf(100) }),
        sessionFixture({ key: 'claude:other', pid: 77, usage: null })
      ],
      NOW_MS
    )
    expect(squad.tokens).toBe(100)
    expect(squad.isTokensPartial).toBe(true)
  })

  it('reads working or idle from the session when there is one, as the Office does', () => {
    const stateOf = (status: 'active' | 'idle', activity: 'running' | 'idle') =>
      buildSquads(
        [instanceFixture({ pid: 1234, status })],
        [sessionFixture({ pid: 1234, activity })],
        NOW_MS
      )[0].agents[0].state
    // A tool waiting on a subprocess burns no CPU and is still working.
    expect(stateOf('idle', 'running')).toBe('working')
    expect(stateOf('active', 'idle')).toBe('idle')
  })

  it('keeps an agent in a worktree in its project squad before the feed arrives', () => {
    const squads = buildSquads(
      [
        instanceFixture({ pid: 1 }),
        instanceFixture({
          pid: 2,
          projectPath: '/Users/test/ZKidz/ClaudeWatch/.claude/.worktree/fix-a',
          projectName: '.worktree/fix-a'
        }),
        instanceFixture({
          pid: 3,
          projectPath: '/Users/test/ZKidz/ClaudeWatch/.claude/worktrees/agent-1',
          projectName: 'worktrees/agent-1'
        })
      ],
      null,
      NOW_MS
    )
    expect(squads.map((squad) => [squad.name, squad.company, squad.agents.length])).toEqual([
      ['ClaudeWatch', 'ZKidz', 3]
    ])
  })

  it('keeps one squad when only some agents of a project are in the office feed', () => {
    const squads = buildSquads(
      [instanceFixture({ pid: 1234 }), instanceFixture({ pid: 77 })],
      [sessionFixture({ pid: 1234 })],
      NOW_MS
    )
    expect(squads).toHaveLength(1)
    expect(squads[0].agents).toHaveLength(2)
  })

  it('names an agent after its session, and falls back to its pid without one', () => {
    const [squad] = buildSquads(
      [instanceFixture({ pid: 1234 }), instanceFixture({ pid: 77 })],
      [sessionFixture({ pid: 1234, name: 'token ledger' })],
      NOW_MS
    )
    expect(squad.agents.map((agent) => agent.name).sort()).toEqual(['Session 77', 'token ledger'])
  })

  it('marks an agent that waits on a permission as needing you, with the reason', () => {
    const [squad] = buildSquads(
      [instanceFixture({ pid: 1234, status: 'idle' })],
      [sessionFixture({ pid: 1234, attention: 'permission' })],
      NOW_MS
    )
    expect(squad.agents[0]).toMatchObject({ state: 'needs-you', stateDetail: 'Needs permission' })
    expect(squad.needsYouCount).toBe(1)
  })

  it('reads working, done, idle, stale and exited from the process when nothing waits', () => {
    const fiveMinutesAgo = new Date(NOW_MS - 5 * 60_000)
    const anHourAgo = new Date(NOW_MS - 60 * 60_000)
    const [squad] = buildSquads(
      [
        instanceFixture({ pid: 1, status: 'active' }),
        instanceFixture({ pid: 2, status: 'idle', lastBecameIdleAt: fiveMinutesAgo }),
        instanceFixture({ pid: 3, status: 'idle', lastBecameIdleAt: anHourAgo }),
        instanceFixture({ pid: 4, status: 'stale' }),
        instanceFixture({ pid: 5, status: 'exited' })
      ],
      null,
      NOW_MS
    )
    expect(squad.agents.map((agent) => [agent.pid, agent.state])).toEqual([
      [1, 'working'],
      [2, 'done'],
      [3, 'idle'],
      [4, 'stale'],
      [5, 'exited']
    ])
  })

  it('shows the tool a working agent is running', () => {
    const [squad] = buildSquads(
      [instanceFixture({ pid: 1234 })],
      [sessionFixture({ pid: 1234, currentTool: { name: 'Bash', category: 'run' } })],
      NOW_MS
    )
    expect(squad.agents[0].stateDetail).toBe('Bash')
  })

  it('puts the squad with an agent that needs you first, and that agent first in it', () => {
    const squads = buildSquads(
      [
        instanceFixture({ pid: 1, projectPath: '/w/Alpha', projectName: 'w/Alpha' }),
        instanceFixture({ pid: 2, projectPath: '/w/Beta', projectName: 'w/Beta' }),
        instanceFixture({ pid: 3, projectPath: '/w/Beta', projectName: 'w/Beta', status: 'idle' })
      ],
      [
        sessionFixture({
          key: 'claude:three',
          pid: 3,
          attention: 'question',
          projectRoot: '/w/Beta',
          projectLabel: 'Beta',
          companyLabel: 'w'
        })
      ],
      NOW_MS
    )
    expect(squads.map((squad) => squad.name)).toEqual(['Beta', 'Alpha'])
    expect(squads[0].agents.map((agent) => agent.pid)).toEqual([3, 2])
  })

  it('totals squad tokens from counted sessions and stays null when none is counted', () => {
    const usage = {
      own: { input: 100, output: 0, cacheWrite: 0, cacheRead: 0 },
      subagents: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      spawned: 0,
      contextTokens: null,
      contextLimit: null
    }
    const counted = buildSquads(
      [instanceFixture({ pid: 1 }), instanceFixture({ pid: 2 })],
      [sessionFixture({ pid: 1, usage }), sessionFixture({ key: 'claude:two', pid: 2 })],
      NOW_MS
    )
    expect(counted[0].tokens).toBe(100)
    expect(counted[0].agents.find((agent) => agent.pid === 2)?.tokens).toBeNull()

    const uncounted = buildSquads([instanceFixture({ pid: 1 })], null, NOW_MS)
    expect(uncounted[0].tokens).toBeNull()
  })
})

describe('filterSquads', () => {
  const squads = buildSquads(
    [
      instanceFixture({ pid: 1 }),
      instanceFixture({ pid: 2, projectPath: '/w/PropApp', projectName: 'w/PropApp' })
    ],
    [sessionFixture({ pid: 1, name: 'token ledger' })],
    NOW_MS
  )

  it('keeps every squad for an empty query', () => {
    expect(filterSquads(squads, '  ')).toHaveLength(2)
  })

  it('matches an agent by its name and drops squads with no match', () => {
    const found = filterSquads(squads, 'LEDGER')
    expect(found.map((squad) => squad.name)).toEqual(['ClaudeWatch'])
  })

  it('keeps the whole squad when the project name matches', () => {
    expect(filterSquads(squads, 'propapp')[0].agents).toHaveLength(1)
  })
})

describe('tallySquads', () => {
  it('counts agents that need you, that work and that rest', () => {
    const squads = buildSquads(
      [
        instanceFixture({ pid: 1 }),
        instanceFixture({ pid: 2, status: 'idle' }),
        instanceFixture({ pid: 3, status: 'idle' }),
        instanceFixture({ pid: 4, status: 'exited' })
      ],
      [sessionFixture({ pid: 2, attention: 'permission' })],
      NOW_MS
    )
    expect(tallySquads(squads)).toEqual({ needsYou: 1, working: 1, resting: 2 })
  })
})

describe('stateOfAttention', () => {
  it('reads both waiting states as needs you, with the reason in words', () => {
    expect(stateOfAttention('permission', 'idle')).toEqual({
      state: 'needs-you',
      detail: 'Needs permission'
    })
    expect(stateOfAttention('question', 'idle')).toEqual({
      state: 'needs-you',
      detail: 'Waiting for you'
    })
  })

  it('reads a busy agent as working and a resting one as idle', () => {
    expect(stateOfAttention('none', 'editing')).toEqual({ state: 'working', detail: null })
    expect(stateOfAttention('none', 'idle').state).toBe('idle')
  })

  it.each(['done', 'error', 'limited'] as const)('keeps %s as its own state', (attention) => {
    expect(stateOfAttention(attention, 'editing')).toEqual({ state: attention, detail: null })
  })
})
