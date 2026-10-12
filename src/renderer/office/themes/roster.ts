import type { ProviderId } from '../../../shared/office/types'
import { rosterName } from './roster-names'
import type { RosterAgent, RosterEntry, ThemeRoster } from './types'

const PROVIDERS: readonly ProviderId[] = ['claude', 'codex', 'opencode']

// FNV-1a with a final mix: keys that differ only in their last digit still spread evenly.
export function agentHash(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  return (hash ^ (hash >>> 13)) >>> 0
}

// One trait of an agent's look. The salt keeps traits independent of each other.
export function pickFor<T>(options: readonly T[], agentKey: string, salt: string): T {
  return options[agentHash(`${salt}/${agentKey}`) % options.length]
}

// How a figure is stretched from its drawn size; the theme's model scales itself by it.
export interface FigureBuild {
  id: string
  height: number
  girth: number
}
export const LEAD_BUILDS: readonly FigureBuild[] = [
  { id: 'standard', height: 1, girth: 1 },
  { id: 'tall', height: 1.09, girth: 0.94 },
  { id: 'stocky', height: 0.93, girth: 1.12 },
  { id: 'broad', height: 1.02, girth: 1.14 }
]
export const SQUAD_BUILDS: readonly FigureBuild[] = [
  { id: 'small', height: 0.8, girth: 0.9 },
  { id: 'slight', height: 0.84, girth: 0.82 },
  { id: 'squat', height: 0.76, girth: 0.98 }
]

export function buildFor(agent: Pick<RosterAgent, 'agentKey' | 'isSubagent'>): FigureBuild {
  return pickFor(agent.isSubagent ? SQUAD_BUILDS : LEAD_BUILDS, agent.agentKey ?? '', 'build')
}

// Local renames are stored by cast index, so a cast only ever grows at its end: `castingOf`
// finds each provider's characters wherever they sit.
export function makeRoster<Character extends RosterEntry>(
  themeId: string,
  cast: readonly Character[],
  castingOf: (character: Character) => { provider: ProviderId; isSquad: boolean }
): ThemeRoster {
  const indexes = (provider: ProviderId, isSquad: boolean): number[] =>
    cast.flatMap((character, index) => {
      const casting = castingOf(character)
      return casting.provider === provider && casting.isSquad === isSquad ? [index] : []
    })
  const pools = new Map(
    PROVIDERS.map((provider) => {
      const pool = { leads: indexes(provider, false), squad: indexes(provider, true) }
      if (pool.leads.length === 0 || pool.squad.length === 0)
        throw new Error(`Theme ${themeId} has no lead or no squad member for ${provider}`)
      return [provider, pool] as const
    })
  )
  return {
    entries: (storage) =>
      cast.map(({ id, name, role }, index) => ({
        id,
        name: rosterName(themeId, index, name, storage),
        role
      })),
    indexFor: (agent, bay) => {
      const pool = pools.get(agent.provider)
      if (!pool) throw new Error(`Theme ${themeId} has no cast for ${agent.provider}`)
      const characters = agent.isSubagent ? pool.squad : pool.leads
      // The key spreads one office's agents over the cast; the bay shifts it per office.
      const turn = agent.agentKey === undefined ? 0 : agentHash(agent.agentKey)
      return characters[(turn + bay) % characters.length]
    }
  }
}

export interface AgentLook<Character> {
  castIndex: number
  // The cast's character, wearing this agent's own trim colour.
  who: Character
  build: FigureBuild
}

// An agent's whole look: its character from the roster, then a build and a trim of its own.
export function makeLooks<Character extends RosterEntry & { trim: string }>(
  roster: ThemeRoster,
  cast: readonly Character[],
  accentsOf: (who: Character) => readonly string[]
): (agent: RosterAgent, bay: number) => AgentLook<Character> {
  // One object per character and trim, so a model can memoise its parts on `who`.
  const dressed = new Map<string, Character>()
  return (agent, bay) => {
    const castIndex = roster.indexFor(agent, bay)
    const trim = pickFor(
      [cast[castIndex].trim, ...accentsOf(cast[castIndex])],
      agent.agentKey ?? '',
      'accent'
    )
    const dressedKey = `${castIndex}/${trim}`
    const who = dressed.get(dressedKey) ?? { ...cast[castIndex], trim }
    dressed.set(dressedKey, who)
    return { castIndex, who, build: buildFor(agent) }
  }
}
