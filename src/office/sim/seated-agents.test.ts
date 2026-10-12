import { expect, it } from 'vitest'
import type { AgentView, SessionRef } from '../../shared/office/types'
import { session } from './fixtures'
import { World } from './world'

const SETTLE_S = 120
function open(sessions: SessionRef[]): World {
  const sim = new World({ now: () => 0 })
  sim.apply({ type: 'hello', v: 1, snapshot: { rev: 0, generatedAtMs: 0, sessions, sources: [] } })
  return sim
}
let seq = 0
const patch = (sim: World, upserts: SessionRef[], removed: string[] = []) =>
  sim.apply({ type: 'patch', v: 1, seq: ++seq, upserts, removed })
const run = (sim: World, seconds: number): AgentView[][] =>
  Array.from({ length: Math.round(seconds * 10) }, () => sim.step(100))
const view = (sim: World, key: string) => sim.step(0).find((a) => a.agentKey === key)!
const deskOf = (sim: World, key: string) =>
  sim
    .layout()
    .floors[0].rooms.find((r) => r.sessionKey === key)!
    .slots.find((s) => s.id === 'desk_main')!
const at = ({ x, z }: { x: number; z: number }) => ({ x, z })
// An earlier project in the same company: each desk column it gains slides what stands after it.
const mates = (count: number): SessionRef[] =>
  Array.from({ length: count }, (_, index) => session(`m${index}`, 'p_0'))
const working = (key: string): SessionRef => ({ ...session(key), activity: 'editing' })

it('keeps a seated agent at its desk when its office slides along with a growing neighbour', () => {
  const sim = open([working('a'), ...mates(1)])
  run(sim, SETTLE_S)
  const oldDesk = at(deskOf(sim, 'a'))
  expect(at(view(sim, 'a'))).toEqual(oldDesk)

  patch(sim, mates(3).slice(1))
  const newDesk = at(deskOf(sim, 'a'))
  expect(newDesk).not.toEqual(oldDesk)
  // The room moved with the agent in it: it is at its desk at once and never gets up.
  for (const views of [
    [view(sim, 'a')],
    ...run(sim, 5).map((all) => all.filter((v) => v.agentKey === 'a'))
  ])
    expect(at(views[0])).toEqual(newDesk)
})

it('leaves every agent where it is when a patch changes nothing about the map', () => {
  const sim = open([working('a'), working('b'), ...mates(2)])
  run(sim, SETTLE_S)
  const before = sim.step(0).map((v) => [v.agentKey, at(v)])
  patch(sim, [{ ...working('a'), activity: 'reading', updatedAtMs: 5 }])
  for (const views of run(sim, 3)) expect(views.map((v) => [v.agentKey, at(v)])).toEqual(before)
})

it('lets an agent that is still walking in finish its walk to where its desk now is', () => {
  const sim = open([...mates(1)])
  run(sim, SETTLE_S)
  patch(sim, [working('a')])
  run(sim, 2)
  const onItsWay = at(view(sim, 'a'))
  expect(onItsWay).not.toEqual(at(deskOf(sim, 'a')))

  patch(sim, mates(3).slice(1))
  // Not seated when its office slid: no jump, it walks on from where it stands.
  expect(at(view(sim, 'a'))).toEqual(onItsWay)
  let last = onItsWay
  for (const views of run(sim, SETTLE_S)) {
    const now = at(views.find((v) => v.agentKey === 'a')!)
    expect(Math.hypot(now.x - last.x, now.z - last.z)).toBeLessThanOrEqual(0.1401)
    last = now
  }
  expect(last).toEqual(at(deskOf(sim, 'a')))
})
