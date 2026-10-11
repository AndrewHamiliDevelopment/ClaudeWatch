import type { TokenCounts } from '../shared/office/types'
import { jsonObject, object } from './io'

export interface UsageFold {
  closed: TokenCounts
  openId: string | null
  open: TokenCounts
}

export const zeroCounts = (): TokenCounts => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 })

export function addCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead
  }
}

export function emptyFold(): UsageFold {
  return { closed: zeroCounts(), openId: null, open: zeroCounts() }
}

// A token count as read from disk: anything that is not a positive number counts as none.
export const tokenCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

// A message is written once per content block and every line repeats its usage, growing while
// it streams. Repeats are adjacent, so one open id is enough: the same id raises each field to
// its maximum, a new id closes the last one. Summing every line over-counts about 2.1 times.
export function foldLines(fold: UsageFold, text: string): UsageFold {
  let { closed, openId, open } = fold
  for (const line of text.split('\n')) {
    // Quotes inside a JSON string are escaped, so this test can skip a line but never a usage.
    if (!line.includes('"usage"')) continue
    const record = jsonObject(line)
    const message = object(record?.message)
    const usage = object(message?.usage)
    if (
      record?.type !== 'assistant' ||
      !message ||
      !usage ||
      typeof message.id !== 'string' ||
      message.model === '<synthetic>'
    )
      continue
    const counts: TokenCounts = {
      input: tokenCount(usage.input_tokens),
      output: tokenCount(usage.output_tokens),
      cacheWrite: tokenCount(usage.cache_creation_input_tokens),
      cacheRead: tokenCount(usage.cache_read_input_tokens)
    }
    if (message.id === openId) {
      open = {
        input: Math.max(open.input, counts.input),
        output: Math.max(open.output, counts.output),
        cacheWrite: Math.max(open.cacheWrite, counts.cacheWrite),
        cacheRead: Math.max(open.cacheRead, counts.cacheRead)
      }
    } else {
      closed = addCounts(closed, open)
      openId = message.id
      open = counts
    }
  }
  return { closed, openId, open }
}

export function foldTotal(fold: UsageFold): TokenCounts {
  return addCounts(fold.closed, fold.open)
}

// What the latest message was sent: everything in the window before its reply.
export function contextTokens(fold: UsageFold): number | null {
  return fold.openId === null ? null : fold.open.input + fold.open.cacheRead + fold.open.cacheWrite
}
