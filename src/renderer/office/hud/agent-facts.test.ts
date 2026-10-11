import { describe, expect, it } from 'vitest'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from '../__tests__/fixtures'
import { buildAgentFacts } from './agent-facts'

const frame = makeFrame({
  floors: [makeFloor({ floorId: 'f1', rooms: [makeRoom({ id: 'r1', sessionKey: 'claude:a' })] })],
  sessions: [
    makeSession({
      key: 'claude:a',
      usage: {
        own: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 },
        subagents: { input: 10, output: 0, cacheWrite: 0, cacheRead: 0 },
        spawned: 2,
        contextTokens: null,
        contextLimit: null
      },
      subagents: [
        { id: 's1', type: 'Explore', activity: 'reading' },
        {
          id: 't1',
          type: 'lena',
          name: 'lena-hud',
          kind: 'teammate',
          activity: 'editing',
          orcaPaneKey: 'pane-2',
          tokens: { input: 5, output: 5, cacheWrite: 0, cacheRead: 0 }
        }
      ]
    })
  ],
  agents: [
    makeAgent({ agentKey: 'claude:a', roomId: 'r1' }),
    makeAgent({ agentKey: 'claude:a#s1', roomId: 'r1', isSubagent: true }),
    makeAgent({ agentKey: 'claude:a#t1', roomId: 'r1', isSubagent: true })
  ]
})

describe('buildAgentFacts', () => {
  const facts = buildAgentFacts(frame)

  it('gives a lead its session total and its own terminal', () => {
    expect(facts.get('claude:a')).toEqual({ kind: 'lead', tokens: 20, focusKey: 'claude:a' })
  })

  it('sends a subagent to its parent terminal and leaves its tokens unknown', () => {
    expect(facts.get('claude:a#s1')).toEqual({
      kind: 'subagent',
      tokens: null,
      focusKey: 'claude:a'
    })
  })

  it('gives a teammate its own tokens and its own terminal', () => {
    expect(facts.get('claude:a#t1')).toEqual({
      kind: 'teammate',
      tokens: 10,
      focusKey: 'claude:a#t1'
    })
  })
})
