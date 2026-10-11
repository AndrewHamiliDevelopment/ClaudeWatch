import { startTimeArgs } from '../shared/ps'
import type { BridgeIo } from './io'
import type { ProcessRow } from './process-table'
import type { RegistryEntry } from './registry'

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
