import type { SessionRef, SourceHealth } from '../shared/office/types'
import { type BridgeIo, jsonObject } from './io'

export interface OrcaEnvironment {
  paneKey: string | null
  worktreeId: string | null
  jobDir: string | null
}
export function parseOrcaEnvironment(command: string): OrcaEnvironment {
  const filtered: OrcaEnvironment = { paneKey: null, worktreeId: null, jobDir: null }
  const pattern = /(?:^|\s)(ORCA_PANE_KEY|ORCA_WORKTREE_ID|CLAUDE_JOB_DIR)=([^\s]*)/g
  for (const match of command.matchAll(pattern)) {
    const value = match[2] || null
    if (match[1] === 'ORCA_PANE_KEY') filtered.paneKey = value
    if (match[1] === 'ORCA_WORKTREE_ID') filtered.worktreeId = value
    if (match[1] === 'CLAUDE_JOB_DIR') filtered.jobDir = value
  }
  if (filtered.jobDir) {
    filtered.paneKey = null
    filtered.worktreeId = null
  }
  return filtered
}

export class OrcaSource {
  private nextPoll = 0
  private delay = 10000
  private health: SourceHealth = { id: 'orca', ok: true, detail: 'not polled' }
  private environments = new Map<string, OrcaEnvironment>()
  constructor(private readonly io: BridgeIo) {}

  async poll(now: number): Promise<SourceHealth> {
    if (now < this.nextPoll) return { ...this.health }
    try {
      await this.io.stat('/opt/homebrew/bin/orca')
      const response = jsonObject(
        await this.io.exec('/opt/homebrew/bin/orca', ['worktree', 'ps', '--json'])
      )
      if (!response || response.ok === false) throw new Error('invalid response')
      this.health = { id: 'orca', ok: true, detail: 'available' }
      this.delay = 10000
      this.nextPoll = now + this.delay
    } catch {
      this.health = { id: 'orca', ok: false, detail: 'unavailable' }
      this.nextPoll = now + this.delay
      this.delay = Math.min(this.delay * 2, 60000)
    }
    return { ...this.health }
  }

  async enrich(session: SessionRef): Promise<SessionRef> {
    if (session.provider !== 'claude' || session.pid === null) return session
    const identity = `${session.pid}:${session.startedAtMs}`
    let environment = this.environments.get(identity)
    if (!environment) {
      try {
        // Only these three keys survive the process-environment read.
        environment = parseOrcaEnvironment(
          await this.io.exec('/bin/ps', ['-E', '-o', 'command=', '-p', String(session.pid)])
        )
      } catch {
        environment = { paneKey: null, worktreeId: null, jobDir: null }
      }
      this.environments.set(identity, environment)
    }
    return {
      ...session,
      host: environment.paneKey ? 'orca' : session.host,
      orcaPaneKey: environment.paneKey
    }
  }
}
