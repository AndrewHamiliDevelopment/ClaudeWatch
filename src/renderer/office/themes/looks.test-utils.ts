import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProviderId } from '../../../shared/office/types'
import { makeAgent } from '../__tests__/fixtures'
import type { PartSpec } from './parts'
import { getTheme, themeCharacter } from './registry'
import { useRobotRig } from './rig'
import type { AgentLook } from './roster'
import { ROSTER_NAMES_STORAGE_KEY } from './roster-names'
import { everyElement, type SceneElement } from './scene.test-utils'
import type { RosterAgent, RosterEntry } from './types'

type Joint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'

export interface LookSubject<Character extends RosterEntry & { trim: string }> {
  themeId: string
  cast: readonly Character[]
  lookOf: (agent: RosterAgent, bay: number) => AgentLook<Character>
  factionOf: (who: Character) => string
  isSquad: (who: Character) => boolean
  figureOf: (who: Character) => {
    joints: Record<Joint, readonly PartSpec[]>
    headPivotY: number
    // Where the thought dots float, in the model's own metres.
    thoughtY: number
  }
}

const PROVIDERS: readonly ProviderId[] = ['claude', 'codex', 'opencode']
const BAY = 2
const keysOf = (provider: ProviderId, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${provider}:session-${index}`)
const top = (parts: readonly PartSpec[], lift = 0): number =>
  Math.max(...parts.map((part) => lift + part.at[1] + part.size[1] / 2))

// The body of a theme's looks test. The caller mocks the React hooks so its model expands.
export function describeLooks<Character extends RosterEntry & { trim: string }>(
  subject: LookSubject<Character>
): void {
  const { themeId, cast, lookOf, factionOf, isSquad, figureOf } = subject
  const lead = (provider: ProviderId, agentKey: string) =>
    lookOf({ provider, isSubagent: false, agentKey }, BAY)
  const squad = (provider: ProviderId, agentKey: string) =>
    lookOf({ provider, isSubagent: true, agentKey }, BAY)
  const lookId = ({ who, build }: AgentLook<Character>) => `${who.id}/${build.id}/${who.trim}`
  const silhouette = (who: Character) => JSON.stringify(figureOf(who).joints)
  const standing = ({ who, build }: AgentLook<Character>): number => {
    const figure = figureOf(who)
    const drawn = Math.max(top(figure.joints.body), top(figure.joints.head, figure.headPivotY))
    return drawn * build.height
  }
  const leadsOf = (provider: ProviderId): Character[] => {
    const ids = new Set(keysOf(provider, 200).map((key) => lead(provider, key).castIndex))
    return [...ids].map((castIndex) => cast[castIndex])
  }
  const modelOf = (provider: ProviderId, isSubagent: boolean, agentKey: string) => {
    const { Model, skins } = getTheme(themeId).robot
    const rig = useRobotRig()
    const agent = makeAgent({ agentKey, provider, isSubagent })
    const props = { agent, skin: skins[provider], rosterIndex: BAY, rig, isReducedMotion: true }
    return { rig, agent, elements: everyElement(createElement(Model, props)) }
  }

  describe(`${themeId} looks`, () => {
    afterEach(() => window.localStorage.clear())

    it.each(PROVIDERS)('gives 12 %s agents at least 8 different looks', (provider) => {
      const looks = keysOf(provider, 12).map((key) => lead(provider, key))
      expect(new Set(looks.map(lookId)).size).toBeGreaterThanOrEqual(8)
      // Not only stretched or recoloured: most of them are different characters too.
      expect(new Set(looks.map(({ who }) => who.id)).size).toBeGreaterThanOrEqual(5)
    })

    it('keeps one look per agent key', () => {
      for (const provider of PROVIDERS)
        for (const key of keysOf(provider, 12)) {
          expect(lead(provider, key)).toEqual(lead(provider, key))
          expect(squad(provider, key)).toEqual(squad(provider, key))
        }
    })

    it('does not seat the same three characters in every office', () => {
      const trio = (prefix: string, bay: number) =>
        [0, 1, 2].map(
          (index) =>
            lookOf({ provider: 'claude', isSubagent: false, agentKey: `${prefix}-${index}` }, bay)
              .who.id
        )
      expect(trio('claude:session', 0)).not.toEqual(trio('claude:session', 1))
      expect(trio('claude:other', BAY)).not.toEqual(trio('claude:session', BAY))
    })

    it('gives each provider a faction of its own, all the same size and eight or more', () => {
      const factions = PROVIDERS.map((provider) => {
        const leads = leadsOf(provider)
        const names = new Set(leads.map(factionOf))
        expect(names.size, provider).toBe(1)
        expect(leads.length, provider).toBeGreaterThanOrEqual(8)
        expect(new Set(leads.map(silhouette)).size, provider).toBe(leads.length)
        return { name: [...names][0], size: leads.length }
      })
      expect(new Set(factions.map((faction) => faction.name)).size).toBe(PROVIDERS.length)
      expect(new Set(factions.map((faction) => faction.size)).size).toBe(1)
      expect(cast.filter((who) => !isSquad(who))).toHaveLength(factions[0].size * PROVIDERS.length)
    })

    it('shows in the inspector the name of the character drawn, renamed or not', () => {
      for (const provider of PROVIDERS)
        for (const isSubagent of [false, true])
          for (const agentKey of keysOf(provider, 12)) {
            const agent = { provider, isSubagent, agentKey }
            const { who, castIndex } = lookOf(agent, BAY)
            expect(cast[castIndex].id).toBe(who.id)
            expect(themeCharacter(themeId, agent, BAY)).toMatchObject({
              id: who.id,
              name: who.name
            })
            const names = cast.map((entry, index) => (index === castIndex ? 'Mine' : entry.name))
            window.localStorage.setItem(
              ROSTER_NAMES_STORAGE_KEY,
              JSON.stringify({ [themeId]: names })
            )
            expect(themeCharacter(themeId, agent, BAY)).toMatchObject({ id: who.id, name: 'Mine' })
            window.localStorage.clear()
          }
    })

    it('draws a subagent as smaller kin of its lead’s faction', () => {
      for (const provider of PROVIDERS) {
        const leadHeights = keysOf(provider, 40).map((key) => standing(lead(provider, key)))
        for (const key of keysOf(provider, 12)) {
          const kin = squad(provider, key)
          expect(isSquad(kin.who)).toBe(true)
          expect(factionOf(kin.who)).toBe(factionOf(lead(provider, key).who))
          expect(standing(kin), kin.who.id).toBeLessThan(Math.min(...leadHeights))
        }
      }
    })

    it('builds every character so the pose reads: arms that reach, a head under its thought', () => {
      for (const who of cast) {
        const { joints, headPivotY, thoughtY } = figureOf(who)
        for (const joint of ['base', 'body', 'leftArm', 'rightArm', 'head', 'gear'] as const)
          expect(joints[joint].length, `${who.id} ${joint}`).toBeGreaterThan(0)
        for (const arm of [joints.leftArm, joints.rightArm]) {
          // An arm hangs below its pivot, so a forward swing carries the hand to the desk.
          const reach = Math.min(...arm.map((part) => part.at[1] - part.size[1] / 2))
          expect(reach, `${who.id} arm`).toBeLessThan(-0.2)
        }
        expect(top(joints.head, headPivotY), `${who.id} head`).toBeLessThanOrEqual(thoughtY)
      }
    })

    it('hangs every look on every rig ref', () => {
      for (const provider of PROVIDERS)
        for (const isSubagent of [false, true])
          for (const agentKey of keysOf(provider, 16)) {
            const { rig, elements } = modelOf(provider, isSubagent, agentKey)
            const holderOf = (ref: object): SceneElement | undefined =>
              elements.find((element) => Reflect.get(element.props, 'ref') === ref)
            for (const ref of [rig.legs, rig.thought, rig.eye, ...rig.puffs])
              expect(holderOf(ref), agentKey).toBeDefined()
            for (const ref of [rig.base, rig.body, rig.leftArm, rig.rightArm, rig.gear, rig.head]) {
              const held = everyElement(holderOf(ref)?.props.children)
              expect(
                held.filter((element) => element.type === 'mesh').length,
                agentKey
              ).toBeGreaterThan(0)
            }
            // The eye blinks inside the head that nods.
            const inHead = everyElement(holderOf(rig.head)?.props.children)
            expect(inHead.some((element) => Reflect.get(element.props, 'ref') === rig.eye)).toBe(
              true
            )
          }
    })

    it('stretches the whole figure by its build', () => {
      const { agent, elements } = modelOf('claude', false, 'claude:session-3')
      const { build } = lookOf(agent, BAY)
      expect(Reflect.get(elements[0].props, 'scale')).toEqual([
        build.girth,
        build.height,
        build.girth
      ])
    })
  })
}
