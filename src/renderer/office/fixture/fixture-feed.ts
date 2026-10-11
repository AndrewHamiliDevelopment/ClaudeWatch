import { projectKey } from '../../../shared/office/project-key'
import type {
  AgentActivity,
  AgentAttention,
  CurrentTool,
  ProviderId,
  SessionRef,
  SubagentRef
} from '../../../shared/office/types'
import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { agentsForFloor, layoutFloor } from './fixture-layout'

interface FixtureSession {
  name: string
  provider: ProviderId
  // Script indexes advance one step every `period` ticks, offset by `offset`.
  period: number
  offset: number
  attentionScript?: readonly AgentAttention[]
  subagentScript?: readonly number[]
}

interface FixtureProject {
  label: string
  root: string
  sessions: readonly FixtureSession[]
}

const ACTIVITY_SCRIPT: readonly AgentActivity[] = [
  'editing',
  'reading',
  'running',
  'thinking',
  'editing',
  'searching',
  'idle',
  'delegating'
]

const TOOL_FOR_ACTIVITY: Record<AgentActivity, CurrentTool | null> = {
  idle: null,
  thinking: null,
  reading: { name: 'Read', category: 'read' },
  editing: { name: 'Edit', category: 'edit' },
  running: { name: 'Bash', category: 'run' },
  searching: { name: 'Grep', category: 'read' },
  delegating: { name: 'Task', category: 'agent' }
}

const SUBAGENT_TYPES = ['Explore', 'code-reviewer', 'test-runner', 'Plan'] as const

const PROJECTS: readonly FixtureProject[] = [
  {
    label: 'ClaudeWatch',
    root: '/Users/dev/ClaudeWatch',
    sessions: [
      {
        name: 'office renderer',
        provider: 'claude',
        period: 3,
        offset: 0,
        subagentScript: [2, 3, 1, 0]
      },
      { name: 'bridge reducer', provider: 'codex', period: 4, offset: 2 },
      {
        name: 'statusline tee',
        provider: 'claude',
        period: 2,
        offset: 5,
        attentionScript: ['none', 'none', 'question', 'question', 'none', 'done']
      },
      {
        name: 'electron upgrade',
        provider: 'claude',
        period: 5,
        offset: 1,
        attentionScript: ['none', 'error', 'error', 'none']
      },
      { name: 'widget sync', provider: 'codex', period: 3, offset: 4 }
    ]
  },
  {
    label: 'PropApp',
    root: '/Users/dev/propapp-v2',
    sessions: [
      {
        name: 'listing search',
        provider: 'claude',
        period: 3,
        offset: 1,
        attentionScript: ['permission', 'permission', 'permission', 'none', 'none']
      },
      {
        name: 'stripe webhooks',
        provider: 'claude',
        period: 4,
        offset: 3,
        subagentScript: [1, 1, 2, 0]
      },
      { name: 'map clustering', provider: 'codex', period: 2, offset: 0 },
      {
        name: 'agent dashboard',
        provider: 'claude',
        period: 5,
        offset: 6,
        attentionScript: ['none', 'limited', 'limited']
      },
      { name: 'image pipeline', provider: 'claude', period: 3, offset: 2 },
      {
        name: 'e2e suite',
        provider: 'codex',
        period: 4,
        offset: 5,
        attentionScript: ['none', 'none', 'done']
      },
      {
        name: 'auth migration',
        provider: 'claude',
        period: 2,
        offset: 7,
        attentionScript: ['none', 'none', 'none', 'permission']
      },
      { name: 'i18n strings', provider: 'claude', period: 6, offset: 3 }
    ]
  },
  {
    label: 'zkidz-claude-team',
    root: '/Users/dev/zkidz-claude-team',
    sessions: [
      { name: 'skill gates', provider: 'claude', period: 3, offset: 2, subagentScript: [0, 1, 1] },
      {
        name: 'installer',
        provider: 'codex',
        period: 4,
        offset: 1,
        attentionScript: ['question', 'none', 'none']
      }
    ]
  }
]

const SECOND_MS = 1000
export const FIXTURE_TICK_MS = 2000
// How far back to look for the start of the current attention or activity run.
const RUN_LOOKBACK_TICKS = 60

function pick<T>(script: readonly T[], tick: number, session: FixtureSession): T {
  const step = Math.floor((tick + session.offset) / session.period)
  return script[((step % script.length) + script.length) % script.length]
}

// First tick of the unbroken run of the current value, so a waiting session's "since" never resets.
function runStartTick<T>(script: readonly T[], tick: number, session: FixtureSession): number {
  const current = pick(script, tick, session)
  let start = tick
  while (start > tick - RUN_LOOKBACK_TICKS && pick(script, start - 1, session) === current)
    start -= 1
  return start
}

function subagentsFor(session: FixtureSession, tick: number, sessionKey: string): SubagentRef[] {
  const count = session.subagentScript ? pick(session.subagentScript, tick, session) : 0
  return Array.from({ length: count }, (_, index) => ({
    id: `${sessionKey}-sub-${index}`,
    type: SUBAGENT_TYPES[index % SUBAGENT_TYPES.length],
    activity: ACTIVITY_SCRIPT[(tick + index * 3) % ACTIVITY_SCRIPT.length]
  }))
}

function sessionFor(
  project: FixtureProject,
  session: FixtureSession,
  index: number,
  context: { tick: number; nowMs: number }
): SessionRef {
  const key = `${session.provider}:${project.label.toLowerCase()}-${index}`
  const attention = session.attentionScript
    ? pick(session.attentionScript, context.tick, session)
    : 'none'
  const activity = attention === 'none' ? pick(ACTIVITY_SCRIPT, context.tick, session) : 'idle'
  const changedAtTick = session.attentionScript
    ? runStartTick(session.attentionScript, context.tick, session)
    : runStartTick(ACTIVITY_SCRIPT, context.tick, session)
  return {
    key,
    provider: session.provider,
    sessionId: key.split(':')[1],
    pid: 40_000 + index,
    name: session.name,
    cwd: project.root,
    projectKey: projectKey(project.root),
    projectLabel: project.label,
    worktree: null,
    host: 'terminal',
    orcaPaneKey: null,
    activity,
    attention,
    currentTool: TOOL_FOR_ACTIVITY[activity],
    subagents: subagentsFor(session, context.tick, key),
    startedAtMs: context.nowMs - (index + 1) * 7 * 60 * SECOND_MS - session.offset * 41 * SECOND_MS,
    updatedAtMs: context.nowMs - (context.tick - changedAtTick) * FIXTURE_TICK_MS
  }
}

// Deterministic for a given tick so tests and screenshots are repeatable.
export function buildFixtureFrame(tick: number, nowMs: number): OfficeFrame {
  const floors = PROJECTS.map((project, plate) => {
    const sessions = project.sessions.map((session, index) =>
      sessionFor(project, session, index, { tick, nowMs })
    )
    const floor = layoutFloor({
      floorId: projectKey(project.root),
      label: project.label,
      plate: plate + 1,
      sessions
    })
    return { floor, sessions, agents: agentsForFloor(floor, sessions) }
  })
  return {
    floors: floors.map((entry) => entry.floor),
    sessions: floors.flatMap((entry) => entry.sessions),
    agents: floors.flatMap((entry) => entry.agents)
  }
}

export function createFixtureFeed(options: { tickMs?: number } = {}): OfficeFeed {
  const tickMs = options.tickMs ?? FIXTURE_TICK_MS
  return {
    subscribe(listener) {
      let tick = 0
      listener(buildFixtureFrame(tick, Date.now()))
      const timer = setInterval(() => {
        tick += 1
        listener(buildFixtureFrame(tick, Date.now()))
      }, tickMs)
      return () => clearInterval(timer)
    },
    jump(sessionKey) {
      console.info(`[office preview] jump to terminal for ${sessionKey}`)
    },
    // The browser preview has no agents to talk to; actions succeed so the UI can be exercised.
    send: async () => ({ success: true }),
    respond: async () => ({ success: true }),
    peek: async () => ({
      success: true,
      lines: [
        '$ npm test',
        '',
        ' ✓ 42 tests passed',
        '',
        'Do you want to proceed?',
        '❯ 1. Yes',
        '  2. No'
      ]
    }),
    start: async () => ({ success: true })
  }
}
