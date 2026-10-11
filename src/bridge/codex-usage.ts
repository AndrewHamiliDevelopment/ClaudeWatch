import type { SessionUsage } from '../shared/office/types'
import { jsonObject, object } from './io'
import { tokenCount, zeroCounts } from './usage-fold'

// Codex keeps a running total for the thread in every `token_count` event, so the newest one
// in the tail is the answer: no fold and no full scan. Cached tokens are part of its input.
export function parseCodexUsage(tail: string): SessionUsage | null {
  let usage: SessionUsage | null = null
  for (const line of tail.split('\n')) {
    if (!line.includes('"token_count"')) continue
    const payload = object(jsonObject(line)?.payload)
    const info = object(payload?.info)
    const total = object(info?.total_token_usage)
    if (payload?.type !== 'token_count' || !info || !total) continue
    const cached = tokenCount(total.cached_input_tokens)
    usage = {
      own: {
        input: Math.max(0, tokenCount(total.input_tokens) - cached),
        output: tokenCount(total.output_tokens),
        cacheWrite: tokenCount(total.cache_write_input_tokens),
        cacheRead: cached
      },
      subagents: zeroCounts(),
      spawned: 0,
      contextTokens: tokenCount(object(info.last_token_usage)?.input_tokens) || null,
      contextLimit: tokenCount(info.model_context_window) || null
    }
  }
  return usage
}
