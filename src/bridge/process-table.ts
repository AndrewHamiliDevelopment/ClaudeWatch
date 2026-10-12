import type { BridgeIo } from './io'

// `ps` with these columns, read with TZ=UTC: one row per process, its start time and argv.
// -x without -A: the owner's own processes, so no other account can pose as one of their agents.
export const PROCESS_TABLE_ARGS = ['-xo', 'pid=,lstart=,command=']

export interface ProcessRow {
  pid: number
  // The start time as `ps` printed it.
  lstart: string
  startedAtMs: number
  argv: string[]
}

export function parseProcessTable(output: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.+)$/.exec(line)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      lstart: match[2],
      startedAtMs: Date.parse(`${match[2]} UTC`),
      argv: match[3].trim().split(/\s+/)
    })
  }
  return rows
}

export const readProcessTable = (io: BridgeIo): Promise<ProcessRow[]> =>
  io.exec('/bin/ps', PROCESS_TABLE_ARGS).then(parseProcessTable)

// The folder a process runs in; undefined when `lsof` names none.
export async function readWorkingFolder(io: BridgeIo, pid: number): Promise<string | undefined> {
  const output = await io.exec('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
  return output
    .split('\n')
    .find((line) => line.startsWith('n/'))
    ?.slice(1)
}

interface RunningProcess {
  pid: number
  startedAtMs: number
}
const identityOf = ({ pid, startedAtMs }: RunningProcess): string => `${pid}:${startedAtMs}`

// Remembered by pid and start time, since asking costs an `lsof` run.
export async function rememberedFolder(
  io: BridgeIo,
  folders: Map<string, string>,
  process: RunningProcess
): Promise<string | undefined> {
  const identity = identityOf(process)
  const known = folders.get(identity)
  if (known) return known
  const cwd = await readWorkingFolder(io, process.pid)
  if (cwd) folders.set(identity, cwd)
  return cwd
}

// Processes sharing a folder claim conversations newest first: an older one would otherwise
// take the newest conversation, written by the one that started after it.
export const newestFirst = <Process extends RunningProcess>(processes: Process[]): Process[] =>
  [...processes].sort((a, b) => b.startedAtMs - a.startedAtMs)

// A process shown before its first conversation keeps that placeholder key once the conversation
// lands, so its robot stays at its desk; `placeholders` is pruned with `forgetExited`.
export function keyOf(
  placeholders: Map<string, string>,
  process: RunningProcess,
  provider: string,
  sessionId: string | undefined
): string {
  const identity = identityOf(process)
  const kept = placeholders.get(identity)
  if (kept) return kept
  if (sessionId) return `${provider}:${sessionId}`
  const placeholder = `${provider}:pid-${process.pid}-${process.startedAtMs}`
  placeholders.set(identity, placeholder)
  return placeholder
}

export function forgetExited(folders: Map<string, string>, running: RunningProcess[]): void {
  const live = new Set(running.map(identityOf))
  for (const identity of folders.keys()) if (!live.has(identity)) folders.delete(identity)
}

// An agent bundled in an app (ChatGPT, Orca helpers) runs from inside the bundle; not a session.
export const isInsideAppBundle = (folder: string): boolean => /\.app\/Contents(\/|$)/.test(folder)
