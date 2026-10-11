// `ps` with these columns, read with TZ=UTC: one row per process, its start time and argv.
export const PROCESS_TABLE_ARGS = ['-Ao', 'pid=,lstart=,command=']

export interface ProcessRow {
  pid: number
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
      startedAtMs: Date.parse(`${match[2]} UTC`),
      argv: match[3].trim().split(/\s+/)
    })
  }
  return rows
}
