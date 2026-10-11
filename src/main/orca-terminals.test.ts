import { describe, it, expect, vi } from 'vitest'
import { OrcaTerminals } from './orca-terminals'

const envelope = (result: unknown): string => JSON.stringify({ id: '1', ok: true, result })

const terminalList = envelope({
  terminals: [
    {
      handle: 'term_a',
      tabId: 'tab1',
      leafId: 'leaf1',
      worktreePath: '/repo/a',
      incarnationId: 'inc_a'
    },
    { handle: 'term_old', tabId: 'tab4', leafId: 'leaf1', worktreePath: '/repo/d' },
    {
      handle: 'term_e',
      tabId: 'tab5',
      leafId: 'leaf1',
      worktreePath: '/repo/e',
      incarnationId: ''
    },
    {
      handle: 'term_b',
      tabId: 'tab2',
      leafId: 'leaf9',
      worktreePath: '/repo/b',
      incarnationId: 'inc_b',
      agentIdentity: 'claude',
      connected: true,
      writable: true,
      orphaned: false
    },
    {
      handle: 'term_c',
      tabId: 'tab3',
      leafId: 'leaf2',
      worktreePath: '/repo/c',
      incarnationId: 'inc_c',
      agentIdentity: 'claude',
      connected: true,
      writable: false,
      orphaned: false
    }
  ]
})

describe('OrcaTerminals', () => {
  it('finds the terminal handle for an Orca pane key (tabId:leafId)', async () => {
    const exec = vi.fn().mockResolvedValue(terminalList)
    const orca = new OrcaTerminals(exec)

    expect(await orca.handleFor('tab2:leaf9')).toEqual({
      handle: 'term_b',
      worktreePath: '/repo/b',
      agent: 'claude',
      incarnationId: 'inc_b'
    })
    expect(await orca.handleFor('tab3:leaf1')).toBeNull()
    expect(exec).toHaveBeenCalledWith(['terminal', 'list', '--json'])
  })

  it('reports no agent for a plain shell and skips terminals that cannot take input', async () => {
    const orca = new OrcaTerminals(vi.fn().mockResolvedValue(terminalList))

    expect(await orca.handleFor('tab1:leaf1')).toMatchObject({ handle: 'term_a', agent: null })
    expect(await orca.handleFor('tab3:leaf2')).toBeNull()
  })

  it('does not use a terminal that Orca gives no incarnation id for', async () => {
    const orca = new OrcaTerminals(vi.fn().mockResolvedValue(terminalList))

    expect(await orca.handleFor('tab4:leaf1')).toBeNull()
    expect(await orca.handleFor('tab5:leaf1')).toBeNull()
  })

  it('sends a prompt as one argv value followed by Enter', async () => {
    const exec = vi.fn().mockResolvedValue(envelope({}))
    await new OrcaTerminals(exec).sendPrompt('term_a', 'run the tests; $(rm -rf ~)')
    expect(exec).toHaveBeenCalledWith([
      'terminal',
      'send',
      '--terminal',
      'term_a',
      '--text',
      'run the tests; $(rm -rf ~)',
      '--enter',
      '--json'
    ])
  })

  it('sends a single key without Enter', async () => {
    const exec = vi.fn().mockResolvedValue(envelope({}))
    await new OrcaTerminals(exec).sendKey('term_a', '1')
    expect(exec).toHaveBeenCalledWith([
      'terminal',
      'send',
      '--terminal',
      'term_a',
      '--text',
      '1',
      '--json'
    ])
  })

  it('reads the rendered screen lines', async () => {
    const exec = vi.fn().mockResolvedValue(envelope({ terminal: { tail: ['line 1', 'line 2'] } }))
    expect(await new OrcaTerminals(exec).screen('term_a')).toEqual(['line 1', 'line 2'])
    expect(exec).toHaveBeenCalledWith([
      'terminal',
      'read',
      '--terminal',
      'term_a',
      '--screen',
      '--json'
    ])
  })

  it('creates a terminal running a fixed agent command in a worktree path', async () => {
    const exec = vi.fn().mockResolvedValue(envelope({}))
    await new OrcaTerminals(exec).create('/repo/a', 'claude', 'New Claude agent')
    expect(exec).toHaveBeenCalledWith([
      'terminal',
      'create',
      '--worktree',
      'path:/repo/a',
      '--command',
      'claude',
      '--title',
      'New Claude agent',
      '--focus',
      '--json'
    ])
  })

  it('throws when Orca answers ok:false or with non-JSON', async () => {
    await expect(
      new OrcaTerminals(vi.fn().mockResolvedValue(JSON.stringify({ ok: false }))).screen('t')
    ).rejects.toThrow()
    await expect(new OrcaTerminals(vi.fn().mockResolvedValue('boom')).screen('t')).rejects.toThrow()
  })
})
