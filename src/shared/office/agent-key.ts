import type { SessionRef } from './types'

type KeyedSession = Pick<SessionRef, 'key'> & { subagents: readonly { id: string }[] }

// A lead is known by its session key; a subagent or teammate by its lead's key and its own id.
export function agentKey(sessionKey: string, memberId: string): string {
  return `${sessionKey}#${memberId}`
}

// The one reading of an agent key: a session, or one member of one lead. A key with two
// readings (a repeated id, a session key holding '#') names no one.
export function parseAgentKey<S extends KeyedSession>(
  key: string,
  sessions: readonly S[]
): { session: S; member?: S['subagents'][number] } | null {
  const readings = sessions.flatMap((session) => {
    if (session.key === key) return [{ session }]
    if (!key.startsWith(agentKey(session.key, ''))) return []
    const memberId = key.slice(session.key.length + 1)
    return session.subagents
      .filter((member) => memberId !== '' && member.id === memberId)
      .map((member) => ({ session, member }))
  })
  return readings.length === 1 ? readings[0] : null
}
