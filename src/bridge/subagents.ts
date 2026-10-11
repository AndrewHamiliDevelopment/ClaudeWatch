import { join } from 'node:path'
import type { SubagentRef } from '../shared/office/types'
import { type BridgeIo, isMissing, jsonObject } from './io'

export async function collectSubagents(
  transcript: string,
  io: BridgeIo,
  now: number
): Promise<SubagentRef[]> {
  const directory = join(transcript.slice(0, -6), 'subagents')
  let files: string[]
  try {
    files = await io.list(directory)
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
  const agents: SubagentRef[] = []
  for (const file of files) {
    const id = /^agent-([\w-]+)\.meta\.json$/.exec(file)?.[1]
    if (!id) continue
    try {
      const modified = (await io.stat(join(directory, `agent-${id}.jsonl`))).mtimeMs
      if (now - modified >= 60000 || modified > now) continue
      const meta = jsonObject(await io.readText(join(directory, file)))
      if (typeof meta?.agentType === 'string')
        agents.push({ id, type: meta.agentType, activity: 'thinking' })
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return agents.sort((a, b) => a.id.localeCompare(b.id))
}
