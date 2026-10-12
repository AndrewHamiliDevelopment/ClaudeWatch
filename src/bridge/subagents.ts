import { join } from 'node:path'
import type { AgentActivity, SubagentRef } from '../shared/office/types'
import { type BridgeIo, isLabel, isMissing, jsonObject } from './io'
import { toolActivity } from './tool-category'
import { readTranscript } from './transcript-tail'

export interface AgentFile {
  id: string
  path: string
  size: number
  mtimeMs: number
}

// subagents/agent-<id>.jsonl, and subagents/workflows/<wf>/agent-<id>.jsonl for workflow agents.
const AGENT_TRANSCRIPT = /^agent-([\w-]+)\.jsonl$/
const MAX_FOLDER_DEPTH = 3
// An agent whose record has been quiet this long is taken to have finished.
export const SUBAGENT_FRESH_MS = 60_000

export async function listAgentFiles(transcript: string, io: BridgeIo): Promise<AgentFile[]> {
  const found: AgentFile[] = []
  async function walk(directory: string, depth: number): Promise<void> {
    let names: string[]
    try {
      names = await io.list(directory)
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }
    for (const name of names) {
      const id = AGENT_TRANSCRIPT.exec(name)?.[1]
      // Meta files, journals and skill markers are never opened or descended into.
      if (!id && (/\.jsonl?$/.test(name) || depth >= MAX_FOLDER_DEPTH)) continue
      const path = join(directory, name)
      try {
        const info = await io.stat(path)
        if (id && !info.directory) found.push({ id, path, size: info.size, mtimeMs: info.mtimeMs })
        else if (!id && info.directory) await walk(path, depth + 1)
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
  }
  await walk(join(transcript.slice(0, -6), 'subagents'), 1)
  return found.sort((a, b) => a.id.localeCompare(b.id))
}

// A fresh record with a tool still open shows as that tool; without one it is thinking.
async function activityOf(file: AgentFile, io: BridgeIo): Promise<AgentActivity> {
  try {
    const { tool } = await readTranscript(file.path, io)
    return tool ? toolActivity(tool.category) : 'thinking'
  } catch (error) {
    if (isMissing(error)) return 'thinking'
    throw error
  }
}

export async function liveSubagents(
  files: AgentFile[],
  io: BridgeIo,
  now: number
): Promise<SubagentRef[]> {
  const agents: SubagentRef[] = []
  for (const file of files) {
    if (now - file.mtimeMs >= SUBAGENT_FRESH_MS || file.mtimeMs > now) continue
    try {
      const meta = jsonObject(await io.readText(file.path.replace(/\.jsonl$/, '.meta.json')))
      if (isLabel(meta?.agentType))
        agents.push({ id: file.id, type: meta.agentType, activity: await activityOf(file, io) })
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return agents
}
