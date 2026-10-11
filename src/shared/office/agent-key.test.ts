import { describe, expect, it } from 'vitest'
import { agentKey, parseAgentKey } from './agent-key'

const session = (key: string, memberIds: string[] = []) => ({
  key,
  subagents: memberIds.map((id) => ({ id }))
})

describe('agentKey', () => {
  it('joins a session key and a member id with #', () => {
    expect(agentKey('claude:s1', 'x')).toBe('claude:s1#x')
  })
})

describe('parseAgentKey', () => {
  it('reads a session key as that session, with no member', () => {
    const lead = session('claude:s1', ['x'])
    expect(parseAgentKey('claude:s1', [lead])).toEqual({ session: lead })
  })

  it('reads a member key as one member of one lead', () => {
    const lead = session('claude:s1', ['x', 'y'])
    const sessions = [session('claude:s10', ['y']), lead]
    expect(parseAgentKey(agentKey('claude:s1', 'y'), sessions)).toEqual({
      session: lead,
      member: lead.subagents[1]
    })
  })

  it.each(['claude:missing', 'claude:s1#nobody', 'claude:missing#x', '', '#'])(
    'reads nothing for the unknown key %j',
    (key) => {
      expect(parseAgentKey(key, [session('claude:s1', ['x'])])).toBeNull()
    }
  )

  it('reads nothing for an id two members share', () => {
    expect(parseAgentKey('claude:s1#x', [session('claude:s1', ['x', 'x'])])).toBeNull()
  })

  it('reads nothing for a key that is both a session and another session’s member', () => {
    const sessions = [session('claude:s1', ['x']), session('claude:s1#x')]
    expect(parseAgentKey('claude:s1#x', sessions)).toBeNull()
  })

  it('reads nothing for a key two leads could both own', () => {
    const sessions = [session('claude:s1', ['a#b']), session('claude:s1#a', ['b'])]
    expect(parseAgentKey('claude:s1#a#b', sessions)).toBeNull()
  })

  it('reads nothing when two sessions report one key', () => {
    expect(parseAgentKey('claude:s1', [session('claude:s1'), session('claude:s1')])).toBeNull()
  })

  it('reads nothing for an empty member id, even when a member reports one', () => {
    expect(parseAgentKey('claude:s1#', [session('claude:s1', [''])])).toBeNull()
  })
})
