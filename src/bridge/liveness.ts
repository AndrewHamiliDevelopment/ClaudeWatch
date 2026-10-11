import type { BridgeIo } from './io'
import type { RegistryEntry } from './registry'

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
export async function isLive(entry: RegistryEntry, io: BridgeIo): Promise<boolean> {
  try {
    const start = await io.exec('/bin/ps', ['-o', 'lstart=', '-p', String(entry.pid)])
    return collapseWhitespace(start) === collapseWhitespace(entry.procStart)
  } catch {
    return false
  }
}
