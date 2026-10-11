import { projectKey } from '../../../shared/office/project-key'
import type { SessionRef, SubagentRef } from '../../../shared/office/types'
import {
  ACTIVITY_SCRIPT,
  TOOL_FOR_ACTIVITY,
  SUBAGENT_TYPES,
  type FixtureSession,
  type FixtureProject
} from './fixture-projects'

const SECOND_MS = 1000
const FIXTURE_TICK_MS = 2000
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

export function sessionFor(
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
    projectRoot: project.root,
    companyKey: projectKey(project.root.slice(0, project.root.lastIndexOf('/'))),
    companyLabel: project.root.split('/').at(-2)!,
    worktree: null,
    host: session.host ?? 'terminal',
    orcaPaneKey: null,
    activity,
    attention,
    currentTool: TOOL_FOR_ACTIVITY[activity],
    subagents: subagentsFor(session, context.tick, key),
    startedAtMs: context.nowMs - (index + 1) * 7 * 60 * SECOND_MS - session.offset * 41 * SECOND_MS,
    updatedAtMs: context.nowMs - (context.tick - changedAtTick) * FIXTURE_TICK_MS
  }
}
