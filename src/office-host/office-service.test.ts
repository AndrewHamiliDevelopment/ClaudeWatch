import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openTerminal, openTerminalRunning } = vi.hoisted(() => ({
  openTerminal: vi.fn(),
  openTerminalRunning: vi.fn()
}))
vi.mock('../main/terminal-opener', () => ({ openTerminal, openTerminalRunning }))

import { ORCA_APP, ORCA_CLI, ORCA_TEAM_ID } from '../main/orca-cli'
import type { FeedMessage, OfficeSnapshot, SessionRef } from '../shared/office/types'
import { createOfficeService, type OfficeService } from './office-service'

const STARTED_AT_MS = Date.parse('Sun Oct 11 09:00:00 2026 UTC')

const session = (overrides: Partial<SessionRef> = {}): SessionRef => ({
  key: 'claude:s1',
  provider: 'claude',
  sessionId: 's1',
  pid: 4242,
  name: 'app',
  cwd: '/repo/app',
  projectKey: 'p_app',
  projectLabel: 'app',
  projectRoot: '/repo/app',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
  worktree: null,
  host: 'orca',
  orcaPaneKey: 'tab1:leaf1',
  activity: 'editing',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: STARTED_AT_MS,
  updatedAtMs: 1,
  ...overrides
})

const envelope = (result: unknown): string => JSON.stringify({ id: '1', ok: true, result })
const TERMINALS = [
  {
    handle: 'term_a',
    tabId: 'tab1',
    leafId: 'leaf1',
    worktreePath: '/repo/app',
    incarnationId: 'inc_1',
    agentIdentity: 'claude'
  }
]

// One Claude agent, pid 4242, in the Orca pane tab1:leaf1 of /repo/app.
function answer(program: string, args: string[]): { stdout: string; stderr: string } {
  const stdout = ((): string => {
    if (program === '/bin/ps') return 'Sun Oct 11 09:00:00 2026\n'
    if (program !== ORCA_CLI) return ''
    return envelope(args[1] === 'list' ? { terminals: TERMINALS } : {})
  })()
  const stderr =
    args[0] === '-dv' ? `Identifier=com.stablyai.orca\nTeamIdentifier=${ORCA_TEAM_ID}` : ''
  return { stdout, stderr }
}

describe('createOfficeService', () => {
  let snapshot: OfficeSnapshot | null
  let feedListeners: Set<(message: FeedMessage) => void>
  const run = vi.fn()
  const terminalOf = vi.fn()
  let service: OfficeService
  const commands = (): [string, string[]][] =>
    run.mock.calls.map(([program, args]) => [program, args])

  beforeEach(() => {
    vi.clearAllMocks()
    snapshot = { rev: 4, generatedAtMs: 1, sessions: [session()], sources: [] }
    feedListeners = new Set()
    run.mockImplementation(async (program: string, args: string[]) => answer(program, args))
    terminalOf.mockResolvedValue('iterm2')
    openTerminal.mockResolvedValue({ success: true })
    openTerminalRunning.mockResolvedValue({ success: true })
    service = createOfficeService({
      host: {
        snapshot: () => snapshot,
        onMessage: (listener) => {
          feedListeners.add(listener)
          return () => {
            feedListeners.delete(listener)
          }
        }
      },
      run,
      terminalOf
    })
  })

  describe('the feed', () => {
    it('gives a new subscriber the current state first, then what the bridge sends', () => {
      const listener = vi.fn()
      service.subscribe(listener)
      for (const deliver of feedListeners) deliver({ type: 'resync' })

      expect(listener.mock.calls).toEqual([
        [{ type: 'hello', v: 1, snapshot }],
        [{ type: 'resync' }]
      ])
    })

    it('sends no hello while the bridge has reported nothing', () => {
      snapshot = null
      const listener = vi.fn()
      service.subscribe(listener)

      expect(listener).not.toHaveBeenCalled()
    })

    it('stops delivering once the subscriber leaves', () => {
      const unsubscribe = service.subscribe(vi.fn())
      unsubscribe()

      expect(feedListeners.size).toBe(0)
    })
  })

  describe('actions', () => {
    it('types a message into the agent’s pane only after proving the pane is its own', async () => {
      expect(await service.send('claude:s1', 'run the tests')).toEqual({ success: true })

      expect(commands()).toEqual([
        ['/bin/ps', ['-o', 'lstart=', '-p', '4242']],
        ['/usr/bin/codesign', ['--verify', '--deep', '--strict', ORCA_APP]],
        ['/usr/bin/codesign', ['-dv', ORCA_APP]],
        [ORCA_CLI, ['terminal', 'list', '--json']],
        [
          ORCA_CLI,
          [
            'terminal',
            'send',
            '--terminal',
            'term_a',
            '--text',
            'run the tests',
            '--enter',
            '--json'
          ]
        ]
      ])
    })

    it('reads process start times in the C locale and UTC', async () => {
      expect(await service.processStart(4242)).toBe(STARTED_AT_MS)
      expect(run).toHaveBeenCalledWith('/bin/ps', ['-o', 'lstart=', '-p', '4242'], {
        timeout: 5000,
        env: { LC_ALL: 'C', TZ: 'UTC' }
      })
    })

    it('reports no start time for a process that is gone', async () => {
      run.mockRejectedValue(new Error('no such process'))
      expect(await service.processStart(4242)).toBeNull()
    })

    it.each([
      ['send', () => service.send({ key: 'claude:s1' }, 'hello')],
      ['send', () => service.send('claude:s1', ['hello'])],
      ['respond', () => service.respond('claude:s1', 'yes', 'abc')],
      ['respond', () => service.respond('claude:s1', 'approve', 7)],
      ['startAgent', () => service.startAgent('p_app', 'gemini')],
      ['startAgent', () => service.startAgent('p_app', null)]
    ])('%s refuses input of the wrong shape and runs no program', async (_name, act) => {
      expect((await act()).success).toBe(false)
      expect(run).not.toHaveBeenCalled()
      expect(openTerminalRunning).not.toHaveBeenCalled()
    })

    it.each([
      ['focus', () => service.focus(4242)],
      ['focus', () => service.focus('claude:nope')],
      ['peek', () => service.peek(null)],
      ['send', () => service.send('claude:nope', 'hello')]
    ])('%s runs no program for a session the bridge never reported', async (_name, act) => {
      expect(await act()).toMatchObject({ success: false, reason: 'unknown-session' })
      expect(run).not.toHaveBeenCalled()
    })

    it('starts an agent in the project folder through Orca', async () => {
      expect(await service.startAgent('p_app', 'codex')).toEqual({ success: true })
      expect(commands().at(-1)?.[1].slice(0, 6)).toEqual([
        'terminal',
        'create',
        '--worktree',
        'path:/repo/app',
        '--command',
        'codex'
      ])
    })

    it('runs nothing from Orca when its signature does not check out', async () => {
      run.mockImplementation(async (program: string, args: string[]) =>
        args[0] === '-dv'
          ? { stdout: '', stderr: 'TeamIdentifier=ABCDE12345' }
          : answer(program, args)
      )

      expect(await service.send('claude:s1', 'run the tests')).toEqual({
        success: false,
        reason: 'orca-unavailable'
      })
      expect(commands().map(([program]) => program)).not.toContain(ORCA_CLI)
    })

    it('opens the folder in the hosting terminal app for an agent outside Orca', async () => {
      snapshot = {
        rev: 5,
        generatedAtMs: 1,
        sessions: [session({ host: 'terminal', orcaPaneKey: null })],
        sources: []
      }

      expect(await service.focus('claude:s1')).toEqual({ success: true, target: 'terminal' })
      expect(terminalOf).toHaveBeenCalledWith(4242)
      expect(openTerminal).toHaveBeenCalledWith('/repo/app', 'iterm2')
      expect(run).not.toHaveBeenCalled()
    })
  })
})
