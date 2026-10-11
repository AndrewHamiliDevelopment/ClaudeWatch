import { describe, expect, it, vi } from 'vitest'
import { collectClaude } from './registry'
import { isLive } from './liveness'
import { collectSubagents } from './subagents'
import { fixtureIo, registryEntry, missing } from './__fixtures__/helpers'

const root = '/claude'
const entry = registryEntry()
const file = `${root}/sessions/42.json`

describe('Claude registry', () => {
  it('drops reused pids and never reads sibling keys', async () => {
    const io = fixtureIo({
      [file]: JSON.stringify(entry),
      [`${root}/sessions/42.key`]: 'DO_NOT_READ'
    })
    io.exec = vi.fn(async () => 'Sun Oct 11 15:29:12 2026')
    const read = vi.spyOn(io, 'readText')
    const batch = await collectClaude([root], io, 1000)
    expect(batch.sessions).toEqual([])
    expect(batch.sources[0].ok).toBe(true)
    expect(read.mock.calls.flat().some((path) => path.endsWith('.key'))).toBe(false)
    expect(io.exec).toHaveBeenCalledWith('/bin/ps', ['-o', 'lstart=', '-p', '42'])
  })
  it('treats a missing root as healthy and empty', async () => {
    const batch = await collectClaude([root], fixtureIo(), 1000)
    expect(batch.sessions).toEqual([])
    expect(batch.sources).toEqual([{ id: `claude:${root}`, ok: true, detail: 'empty' }])
  })
  it('ingests live entries, fallback transcripts and permission attention', async () => {
    const waiting = {
      ...entry,
      status: 'waiting',
      waitingFor: 'approval requested',
      statusUpdatedAt: '2026-10-11T00:00:00Z'
    }
    const io = fixtureIo({
      [file]: JSON.stringify(waiting),
      '/repo/.git': null,
      '/claude/projects/old/a.jsonl': ''
    })
    io.exec = async () => ' Sat  Oct 10 15:29:12 2026 '
    const batch = await collectClaude([root], io, 1000)
    expect(batch.sessions[0]).toMatchObject({
      attention: 'permission',
      projectLabel: 'repo',
      currentTool: null
    })
  })
  it('skips malformed entries and marks inaccessible roots unhealthy', async () => {
    const io = fixtureIo({
      [file]: '{',
      '/claude/sessions/43.json': JSON.stringify({ ...entry, sessionId: '../unsafe' })
    })
    expect((await collectClaude([root], io, 1000)).sessions).toEqual([])
    io.list = async () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' })
    }
    expect((await collectClaude([root], io, 1000)).sources[0].ok).toBe(false)
  })
  it('collapses whitespace in starts and treats missing pids as dead', async () => {
    const io = fixtureIo()
    io.exec = async () => 'Sat  Oct 10 15:29:12 2026\n'
    expect(await isLive(entry, io)).toBe(true)
    io.exec = async () => {
      throw missing()
    }
    expect(await isLive(entry, io)).toBe(false)
  })
})

describe('subagents', () => {
  it('keeps only fresh id and agent type, excluding descriptions', async () => {
    const io = fixtureIo({
      '/t/subagents/agent-abc.meta.json': JSON.stringify({
        agentType: 'Explore',
        description: 'PRIVATE_DESCRIPTION'
      }),
      '/t/subagents/agent-abc.jsonl': 'PRIVATE_TRANSCRIPT',
      '/t/subagents/agent-old.meta.json': '{}'
    })
    expect(await collectSubagents('/t.jsonl', io, 2000)).toEqual([
      { id: 'abc', type: 'Explore', activity: 'thinking' }
    ])
    expect(await collectSubagents('/t.jsonl', io, 62000)).toEqual([])
  })
})
