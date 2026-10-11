import { join } from 'node:path'
import { type BridgeIo, isMissing, jsonObject } from './io'

// The first record naming the team follows an attachment of about 80 KB.
const HEAD_BYTES = 256 * 1024

// The agent a transcript belongs to, when its head names this team. Only the two labels are kept.
function teammateNamedIn(head: string, team: string): string | null {
  for (const line of head.split('\n')) {
    if (!line.includes('"teamName"')) continue
    const record = jsonObject(line)
    if (typeof record?.teamName !== 'string' || typeof record.agentName !== 'string') continue
    return record.teamName === team ? record.agentName : null
  }
  return null
}

// A teammate's transcript is a top-level file in its working directory's project folder, with
// no link to the roster but the team and agent names its records carry. Newest file per agent.
export async function newestTeammateTranscripts(
  folder: string,
  team: string,
  sinceMs: number,
  io: BridgeIo
): Promise<Map<string, string>> {
  const newest = new Map<string, { path: string; mtimeMs: number }>()
  let names: string[]
  try {
    names = await io.list(folder)
  } catch (error) {
    if (isMissing(error)) return new Map()
    throw error
  }
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue
    const path = join(folder, name)
    try {
      const info = await io.stat(path)
      if (info.directory || info.mtimeMs < sinceMs) continue
      const agent = teammateNamedIn((await io.readFrom(path, 0, HEAD_BYTES)).text, team)
      if (agent && info.mtimeMs >= (newest.get(agent)?.mtimeMs ?? 0))
        newest.set(agent, { path, mtimeMs: info.mtimeMs })
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return new Map([...newest].map(([agent, file]) => [agent, file.path]))
}
