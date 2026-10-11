import { beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'path'
import { pathToFileURL } from 'url'

const { handle, execFilePromise, openTerminal, fork } = vi.hoisted(() => ({
  handle: vi.fn(),
  execFilePromise: vi.fn(),
  openTerminal: vi.fn(),
  fork: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle },
  app: { isPackaged: false },
  screen: { getAllDisplays: () => [] },
  utilityProcess: { fork },
  BrowserWindow: vi.fn()
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./platform/exec', () => ({ execFilePromise }))
vi.mock('./terminal-opener', () => ({ openTerminal, openTerminalRunning: vi.fn() }))

import { setupOffice } from './office-setup'
import { ORCA_APP, ORCA_CLI, ORCA_TEAM_ID } from './orca-cli'

const pageEvent = (page: string): unknown => ({
  senderFrame: { parent: null, url: pathToFileURL(join(__dirname, '../renderer', page)).href }
})
const officeEvent = pageEvent('office.html')
const envelope = (result: unknown): string => JSON.stringify({ id: '1', ok: true, result })

// One Claude agent, pid 4242, in the Orca pane tab1:leaf1 of /repo/app.
function answer(program: string, args: string[]): { stdout: string; stderr: string } {
  const stdout = ((): string => {
    if (program === '/bin/ps' && args.includes('lstart=')) return 'Sun Oct 11 09:00:00 2026\n'
    // Shaped like `ps -E`: the command line, then the environment, secrets included.
    if (program === '/bin/ps')
      return 'claude --resume x ANTHROPIC_API_KEY=sk-not-kept ORCA_PANE_KEY=tab1:leaf1 HOME=/Users/dev\n'
    if (program !== ORCA_CLI) return ''
    if (args[1] === 'list')
      return envelope({
        terminals: [
          {
            handle: 'term_a',
            tabId: 'tab1',
            leafId: 'leaf1',
            worktreePath: '/repo/app',
            incarnationId: 'inc_1',
            agentIdentity: 'claude'
          }
        ]
      })
    return envelope({ focus: { handle: 'term_a', navigated: true } })
  })()
  const stderr =
    args[0] === '-dv' ? `Identifier=com.stablyai.orca\nTeamIdentifier=${ORCA_TEAM_ID}` : ''
  return { stdout, stderr }
}

describe('setupOffice', () => {
  let handlers: Record<string, (...args: unknown[]) => unknown>
  let office: ReturnType<typeof setupOffice>
  const tracker = { getInstances: vi.fn() }
  const terminalResolver = { resolve: vi.fn() }
  const store = { getOfficeWindowBounds: vi.fn(), setOfficeWindowBounds: vi.fn() }
  const commands = (): [string, string[]][] =>
    execFilePromise.mock.calls.map(([program, args]) => [program, args])

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    handle.mockImplementation((channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers[channel] = listener
    })
    execFilePromise.mockImplementation(async (program: string, args: string[]) =>
      answer(program, args)
    )
    openTerminal.mockResolvedValue({ success: true })
    terminalResolver.resolve.mockResolvedValue({ terminalType: 'iterm2' })
    tracker.getInstances.mockReturnValue([{ pid: 4242, projectPath: '/repo/app' }])
    office = setupOffice(terminalResolver, store, tracker)
  })

  describe('the bridge', () => {
    const bridge = { on: vi.fn(), kill: vi.fn() }
    const snapshot = { rev: 3, generatedAtMs: 1, sessions: [], sources: [] }
    const bridgeSays = (message: unknown): void => {
      const [, listener] = bridge.on.mock.calls.find(([event]) => event === 'message') ?? []
      listener(message)
    }

    beforeEach(() => fork.mockReturnValue(bridge))

    it('is not running, and has nothing to report, until the app starts it', () => {
      expect(fork).not.toHaveBeenCalled()
      expect(office.snapshot()).toBeNull()
    })

    it('runs from start to stop with no Office window, serving its latest snapshot', () => {
      office.start()
      expect(fork).toHaveBeenCalledExactlyOnceWith(join(__dirname, 'bridge.js'), [], {
        serviceName: 'ClaudeWatch Office Bridge'
      })
      bridgeSays({ type: 'hello', v: 1, snapshot })
      expect(office.snapshot()).toEqual(snapshot)

      office.stop()
      expect(bridge.kill).toHaveBeenCalledOnce()
      expect(office.snapshot()).toBeNull()
    })
  })

  it.each(['office:focus', 'office:jump'])('%s answers the Office page only', async (channel) => {
    for (const event of [pageEvent('index.html'), { senderFrame: null }, null]) {
      expect(() => handlers[channel](event, 'claude:s1')).toThrow('Untrusted IPC sender')
    }
    expect(await handlers[channel](officeEvent, 'claude:s1')).toEqual({
      success: false,
      reason: 'unknown-session'
    })
  })

  it.each(['office:focus', 'office:jump'])(
    '%s runs no program for a key the bridge never reported',
    async (channel) => {
      for (const agentKey of ['claude:nope', 'claude:nope#lena', 4242, null, { key: 'x' }]) {
        expect(await handlers[channel](officeEvent, agentKey)).toEqual({
          success: false,
          reason: 'unknown-session'
        })
      }
      expect(execFilePromise).not.toHaveBeenCalled()
    }
  )

  it('runs no program for a pid the tracker does not list', async () => {
    expect(await office.focusSession(1)).toEqual({ success: false, reason: 'unknown-session' })
    expect(execFilePromise).not.toHaveBeenCalled()
  })

  it('focuses a tracked Orca agent’s pane with fixed commands and no input', async () => {
    expect(await office.focusSession(4242)).toEqual({ success: true, target: 'pane' })

    expect(commands()).toEqual([
      ['/bin/ps', ['-o', 'lstart=', '-p', '4242']],
      ['/bin/ps', ['-E', '-o', 'command=', '-p', '4242']],
      ['/bin/ps', ['-o', 'lstart=', '-p', '4242']],
      ['/usr/bin/codesign', ['--verify', ORCA_APP]],
      ['/usr/bin/codesign', ['-dv', ORCA_APP]],
      [ORCA_CLI, ['terminal', 'list', '--json']],
      [ORCA_CLI, ['terminal', 'switch', '--terminal', 'term_a', '--json']],
      ['/usr/bin/open', ['-b', 'com.stablyai.orca']]
    ])
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('runs nothing from Orca, and opens no terminal, when its signature does not check out', async () => {
    execFilePromise.mockImplementation(async (program: string, args: string[]) => {
      if (args[0] === '-dv') return { stdout: '', stderr: 'TeamIdentifier=ABCDE12345' }
      return answer(program, args)
    })

    expect(await office.focusSession(4242)).toEqual({
      success: false,
      reason: 'orca-unavailable'
    })
    const programs = commands().map(([program]) => program)
    expect(programs).not.toContain(ORCA_CLI)
    expect(programs).not.toContain('/usr/bin/open')
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('opens the tracked folder in the agent’s own terminal app outside Orca', async () => {
    execFilePromise.mockImplementation(async (program: string, args: string[]) =>
      args.includes('-E')
        ? { stdout: 'claude HOME=/Users/dev\n', stderr: '' }
        : answer(program, args)
    )

    expect(await office.focusSession(4242)).toEqual({ success: true, target: 'terminal' })
    expect(terminalResolver.resolve).toHaveBeenCalledWith(4242)
    expect(openTerminal).toHaveBeenCalledWith('/repo/app', 'iterm2')
    expect(commands().map(([program]) => program)).toEqual(['/bin/ps', '/bin/ps'])
  })
})
