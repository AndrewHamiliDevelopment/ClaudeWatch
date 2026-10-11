import { describe, expect, it, vi } from 'vitest'
import { OrcaSource, parseOrcaEnvironment } from './orca'
import { fixtureIo, missing, session } from './__fixtures__/helpers'

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
      const io = fixtureIo({ '/opt/homebrew/bin/orca': '' })
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
    const io = fixtureIo({ '/opt/homebrew/bin/orca': '' })
    io.exec = vi.fn(async (file) =>
      file.endsWith('orca') ? '{"ok":true,"data":[]}' : 'claude ORCA_PANE_KEY=p SECRET=hidden'
    )
    const source = new OrcaSource(io)
    expect((await source.poll(0)).ok).toBe(true)
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
