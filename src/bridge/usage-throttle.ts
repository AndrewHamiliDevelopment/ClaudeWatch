import type { SessionRef, SessionUsage, TokenCounts } from '../shared/office/types'

const PUBLISH_INTERVAL_MS = 10000

interface Published {
  atMs: number
  usage: SessionUsage | null
  tokens: Map<string, TokenCounts | null>
}

// Counters move on every turn, and each change re-sends the session and rebuilds the office
// layout. Holding a session's numbers for ten seconds keeps that to one patch per window.
export class UsageThrottle {
  private published = new Map<string, Published>()

  apply(session: SessionRef, now: number): SessionRef {
    const fresh = {
      usage: session.usage ?? null,
      tokens: new Map(session.subagents.map((agent) => [agent.id, agent.tokens ?? null]))
    }
    const last = this.published.get(session.key)
    // The first numbers are never held back: an uncounted session shows a dash until they come.
    if (!last || last.usage === null || now - last.atMs >= PUBLISH_INTERVAL_MS) {
      const isUnchanged =
        last &&
        JSON.stringify([last.usage, [...last.tokens]]) ===
          JSON.stringify([fresh.usage, [...fresh.tokens]])
      if (!isUnchanged) this.published.set(session.key, { atMs: now, ...fresh })
      return session
    }
    // An agent that arrived since the last publish shows its numbers from now on.
    last.tokens = new Map(
      [...fresh.tokens].map(([id, tokens]) => {
        const held = last.tokens.get(id)
        return [id, held === undefined ? tokens : held]
      })
    )
    return {
      ...session,
      usage: last.usage,
      subagents: session.subagents.map((agent) => ({ ...agent, tokens: last.tokens.get(agent.id) }))
    }
  }

  prune(liveKeys: ReadonlySet<string>): void {
    for (const key of this.published.keys()) if (!liveKeys.has(key)) this.published.delete(key)
  }
}
