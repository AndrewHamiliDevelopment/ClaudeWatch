import { describe, expect, it, vi } from 'vitest'
import { claimPanes, OrcaSource, parseOrcaEnvironment } from './orca'
import { ORCA_CLI } from './io'
import { fixtureIo, missing, session } from './__fixtures__/helpers'
import type { SubagentRef } from '../shared/office/types'

const teammate = (name: string, pid: number, startedAtMs: number): SubagentRef => ({
  id: `${name}@session-a`,
  type: 'lena',
  activity: 'thinking',
  kind: 'teammate',
  name,
  pid,
  startedAtMs,
  orcaPaneKey: null,
  tokens: null
})

it('CLAUDE_JOB_DIR suppresses Orca identifiers and discards other env', () => {
  expect(
    parseOrcaEnvironment(
      'claude SECRET=hidden ORCA_PANE_KEY=p ORCA_WORKTREE_ID=w CLAUDE_JOB_DIR=/job'
    )
  ).toEqual({ jobDir: '/job', paneKey: null, worktreeId: null })
  expect(parseOrcaEnvironment('claude SECRET=hidden ORCA_PANE_KEY=p ORCA_WORKTREE_ID=w')).toEqual({
    jobDir: null,
    paneKey: 'p',
    worktreeId: 'w'
  })
})

describe('Orca polling', () => {
  it.each(['missing', 'bad-json', 'not-ok'])(
    'backs off on %s and caps retry delay at 60s',
    async (failure) => {
      const io = fixtureIo({ [ORCA_CLI]: '' })
      io.exec = vi.fn(async () => {
        if (failure === 'missing') throw missing()
        return failure === 'bad-json' ? 'invalid' : '{"ok":false}'
      })
      const source = new OrcaSource(io)
      expect((await source.poll(0)).ok).toBe(false)
      await source.poll(9999)
      expect(io.exec).toHaveBeenCalledTimes(1)
      await source.poll(10000)
      await source.poll(29999)
      expect(io.exec).toHaveBeenCalledTimes(2)
      await source.poll(30000)
      await source.poll(69999)
      expect(io.exec).toHaveBeenCalledTimes(3)
      await source.poll(70000)
      await source.poll(129999)
      expect(io.exec).toHaveBeenCalledTimes(4)
      await source.poll(130000)
      expect(io.exec).toHaveBeenCalledTimes(5)
    }
  )
  it('polls successful responses at most every 10s and reads each new pid env once', async () => {
    const io = fixtureIo({ [ORCA_CLI]: '' })
    io.exec = vi.fn(async (file) =>
      file.endsWith('orca') ? '{"ok":true,"data":[]}' : 'claude ORCA_PANE_KEY=p SECRET=hidden'
    )
    const source = new OrcaSource(io)
    expect((await source.poll(0)).ok).toBe(true)
    expect(io.exec).toHaveBeenCalledWith(ORCA_CLI, ['worktree', 'ps', '--json'])
    await source.poll(9000)
    const ref = session('a')
    expect(await source.enrich(ref)).toMatchObject({ host: 'orca', orcaPaneKey: 'p' })
    await source.enrich(ref)
    expect(io.exec).toHaveBeenCalledTimes(2)
    await source.enrich({ ...ref, startedAtMs: 1 })
    expect(io.exec).toHaveBeenCalledTimes(3)
  })
  it('keeps jobs in terminal hosts', async () => {
    const io = fixtureIo()
    io.exec = async () => 'claude ORCA_PANE_KEY=p CLAUDE_JOB_DIR=/job'
    expect(await new OrcaSource(io).enrich(session('a'))).toMatchObject({
      host: 'terminal',
      orcaPaneKey: null
    })
  })
})

it('retries failed environment reads after 30 seconds', async () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(0)
    const io = fixtureIo()
    io.exec = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('claude ORCA_PANE_KEY=p')
    const source = new OrcaSource(io)
    expect((await source.enrich(session('a'))).orcaPaneKey).toBeNull()
    vi.setSystemTime(29999)
    await source.enrich(session('a'))
    expect(io.exec).toHaveBeenCalledTimes(1)
    vi.setSystemTime(30000)
    expect((await source.enrich(session('a'))).orcaPaneKey).toBe('p')
    expect(io.exec).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

it('reads each teammate’s pane from its own process, once, and forgets it when it leaves', async () => {
  const io = fixtureIo()
  io.exec = vi.fn(async (_file, args) => `claude ORCA_PANE_KEY=pane-of-${args.at(-1)} SECRET=x`)
  const source = new OrcaSource(io)
  const lead = { ...session('a'), subagents: [teammate('lena', 77, 5), teammate('ravi', 78, 6)] }
  const plain = { id: 'abc', type: 'Explore', activity: 'thinking' as const }
  const enriched = await source.enrich({ ...lead, subagents: [...lead.subagents, plain] })
  expect(enriched.orcaPaneKey).toBe('pane-of-42')
  expect(enriched.subagents.map((agent) => agent.orcaPaneKey)).toEqual([
    'pane-of-77',
    'pane-of-78',
    undefined
  ])
  source.prune([lead])
  await source.enrich(lead)
  expect(io.exec).toHaveBeenCalledTimes(3)
  source.prune([{ ...lead, subagents: [lead.subagents[0]] }])
  await source.enrich(lead)
  expect(io.exec).toHaveBeenCalledTimes(4)
})

it('takes a pane away from a teammate that only inherited it', () => {
  const pane = (agent: SubagentRef, orcaPaneKey: string): SubagentRef => ({ ...agent, orcaPaneKey })
  const lead = {
    ...session('lead'),
    host: 'orca' as const,
    orcaPaneKey: 't:l',
    startedAtMs: 10,
    subagents: [
      pane(teammate('inherited', 77, 20), 't:l'),
      pane(teammate('own', 78, 30), 't:own'),
      pane(teammate('shared-later', 79, 50), 't:shared'),
      pane(teammate('shared-first', 80, 40), 't:shared')
    ]
  }
  const [claimed] = claimPanes([lead])
  expect(claimed.orcaPaneKey).toBe('t:l')
  expect(claimed.subagents.map((agent) => [agent.name, agent.orcaPaneKey])).toEqual([
    ['inherited', null],
    ['own', 't:own'],
    ['shared-later', null],
    ['shared-first', 't:shared']
  ])
})

it('lets only the earliest session keep a pane that several sessions report', () => {
  const parent = {
    ...session('parent'),
    host: 'orca' as const,
    orcaPaneKey: 't:l',
    startedAtMs: 10
  }
  const child = { ...session('child'), host: 'orca' as const, orcaPaneKey: 't:l', startedAtMs: 20 }
  const other = { ...session('other'), host: 'orca' as const, orcaPaneKey: 't:m', startedAtMs: 30 }
  expect(claimPanes([child, other, parent]).map((s) => [s.sessionId, s.orcaPaneKey])).toEqual([
    ['child', null],
    ['other', 't:m'],
    ['parent', 't:l']
  ])
})
