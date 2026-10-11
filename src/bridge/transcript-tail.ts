import { join } from 'node:path'
import type { CurrentTool } from '../shared/office/types'
import { type BridgeIo, isMissing, jsonObject, object } from './io'
import { toolCategory } from './tool-category'

export interface TranscriptState {
  tool: CurrentTool | null
  error: boolean
}

export function parseTranscript(text: string): TranscriptState {
  const tools: { id: string; name: string }[] = []
  const results = new Map<string, boolean>()
  for (const line of text.split('\n')) {
    const record = jsonObject(line)
    const content = object(record?.message)?.content
    if (!Array.isArray(content)) continue
    for (const value of content) {
      const block = object(value)
      if (
        record?.type === 'assistant' &&
        block?.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
      ) {
        tools.push({ id: block.id, name: block.name })
      }
      if (
        record?.type === 'user' &&
        block?.type === 'tool_result' &&
        typeof block.tool_use_id === 'string'
      ) {
        results.set(block.tool_use_id, block.is_error === true)
      }
    }
  }
  const current = tools.findLast((tool) => !results.has(tool.id))
  const latest = tools.at(-1)
  return {
    tool: current ? { name: current.name, category: toolCategory(current.name) } : null,
    error: !!latest && results.get(latest.id) === true
  }
}

const paths = new WeakMap<BridgeIo, Map<string, string>>()

export async function transcriptPath(
  root: string,
  cwd: string,
  sessionId: string,
  io: BridgeIo
): Promise<string | null> {
  let cache = paths.get(io)
  if (!cache) paths.set(io, (cache = new Map()))
  const key = JSON.stringify([root, cwd, sessionId])
  const cached = cache.get(key)
  if (cached) return cached
  const remember = (path: string): string => {
    // Bound discovery state even when the bridge runs across many sessions.
    if (cache.size >= 1024) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, path)
    return path
  }
  const projects = join(root, 'projects')
  const direct = join(projects, cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`)
  try {
    await io.stat(direct)
    return remember(direct)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  let slugs: string[]
  try {
    slugs = await io.list(projects)
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  for (const slug of slugs) {
    const candidate = join(projects, slug, `${sessionId}.jsonl`)
    try {
      await io.stat(candidate)
      return remember(candidate)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return null
}
