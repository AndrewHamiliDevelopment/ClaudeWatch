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
