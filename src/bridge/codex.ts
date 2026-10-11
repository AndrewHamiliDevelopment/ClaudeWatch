import { basename } from 'node:path'
import type {
  AgentActivity,
  AgentAttention,
  SessionRef,
  SourceHealth
} from '../shared/office/types'
import { projectKey } from '../shared/office/project-key'
import { type BridgeIo, jsonObject, object } from './io'
import { resolveProject } from './project-root'
import { findRollouts } from './codex-rollouts'

export function parseCodexProcesses(output: string): { pid: number; startedAtMs: number }[] {
  const processes: { pid: number; startedAtMs: number }[] = []
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.+)$/.exec(line)
    if (!match) continue
    const argv = match[3].trim().split(/\s+/)
    if (
      basename(argv[0]) !== 'codex' ||
      argv.slice(1).some((arg) => /^(app-server|helper)/.test(arg))
    )
      continue
    processes.push({ pid: Number(match[1]), startedAtMs: Date.parse(`${match[2]} UTC`) })
  }
  return processes
}
export function parseCodexActivity(tail: string): {
  activity: AgentActivity
  attention: AgentAttention
  updatedAtMs: number
} {
  let activity: AgentActivity = 'idle'
  let attention: AgentAttention = 'none'
  let updatedAtMs = 0
  for (const line of tail.split('\n')) {
    const record = jsonObject(line)
    // Current CLI rollouts place tool/reasoning events in response_item records.
    if (record?.type !== 'event_msg' && record?.type !== 'response_item') continue
    const type = object(record.payload)?.type
    if (type === 'function_call' || type === 'custom_tool_call') activity = 'running'
    else if (type === 'reasoning') activity = 'thinking'
    else if (type === 'task_complete') activity = 'idle'
    else continue
    attention = type === 'task_complete' ? 'done' : 'none'
    const timestamp = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : 0
    updatedAtMs = Number.isFinite(timestamp) ? timestamp : 0
  }
  return { activity, attention, updatedAtMs }
}

export async function collectCodex(
  root: string,
  io: BridgeIo
): Promise<{ sessions: SessionRef[]; sources: SourceHealth[] }> {
  const sessions: SessionRef[] = []
  const health: SourceHealth = { id: 'codex', ok: true, detail: 'empty' }
  try {
    const processes = parseCodexProcesses(
      await io.exec('/bin/ps', ['-Ao', 'pid=,lstart=,command='])
    )
    const rollouts = processes.length ? await findRollouts(root, io) : []
    const used = new Set<string>()
    for (const process of processes) {
      try {
        const cwdOutput = await io.exec('/usr/sbin/lsof', [
          '-a',
          '-p',
          String(process.pid),
          '-d',
          'cwd',
          '-Fn'
        ])
        const cwd = cwdOutput
          .split('\n')
          .find((line) => line.startsWith('n/'))
          ?.slice(1)
        if (!cwd) continue
        const rollout = rollouts.find((item) => item.cwd === cwd && !used.has(item.id))
        if (rollout) used.add(rollout.id)
        const id = rollout?.id ?? `pid-${process.pid}-${process.startedAtMs}`
        const state = rollout
          ? parseCodexActivity(await io.readTail(rollout.path))
          : {
              activity: 'idle' as const,
              attention: 'none' as const,
              updatedAtMs: process.startedAtMs
            }
        const project = await resolveProject(cwd, io)
        sessions.push({
          key: `codex:${id}`,
          provider: 'codex',
          sessionId: id,
          pid: process.pid,
          name: basename(cwd),
          cwd,
          projectKey: projectKey(project.root),
          projectLabel: basename(project.root),
          worktree: project.worktree,
          host: 'terminal',
          orcaPaneKey: null,
          ...state,
          currentTool: null,
          subagents: [],
          startedAtMs: process.startedAtMs
        })
        health.detail = 'live'
      } catch {
        health.ok = false
        health.detail = 'process read failed'
      }
    }
  } catch {
    health.ok = false
    health.detail = 'discovery failed'
  }
  return { sessions, sources: [health] }
}
