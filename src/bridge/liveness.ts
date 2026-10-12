import { startTimeArgs } from '../shared/ps'
import type { BridgeIo } from './io'
import type { ProcessRow } from './process-table'
import type { RegistryEntry } from './registry'

// An agent whose record has been quiet this long is taken to have finished.
export const SUBAGENT_FRESH_MS = 60_000
// A long build or test writes nothing until it returns: an agent with a tool open stays this long.
export const OPEN_TOOL_HOLD_MS = 15 * 60_000
// `now` is read before the files are, so one written during the tick may look a little ahead.
export const CLOCK_SKEW_MS = 5_000

// How long a record has been quiet, or null when it is dated further ahead than skew explains.
export function quietFor(now: number, atMs: number): number | null {
  const quietMs = now - atMs
  return quietMs < -CLOCK_SKEW_MS ? null : Math.max(0, quietMs)
}

export const isStillWorking = (quietMs: number, freshMs: number, hasOpenTool: boolean): boolean =>
  quietMs < freshMs || (hasOpenTool && quietMs < OPEN_TOOL_HOLD_MS)

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
// The owner's process table answers for a pid it lists. `ps` is asked only about one it lacks,
// which may still run under another account.
export async function isLive(
  entry: RegistryEntry,
  io: BridgeIo,
  table: ProcessRow[]
): Promise<boolean> {
  try {
    const listed = table.find((row) => row.pid === entry.pid)?.lstart
    const start = listed ?? (await io.exec('/bin/ps', startTimeArgs(entry.pid)))
    return collapseWhitespace(start) === collapseWhitespace(entry.procStart)
  } catch {
    return false
  }
}
