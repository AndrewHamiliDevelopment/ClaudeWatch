import { expect, it } from 'vitest'
import { contextTokens, emptyFold, foldLines, foldTotal } from './usage-fold'

// One transcript line as Claude Code writes it: a message is repeated once per content block.
function line(id: string, usage: Record<string, number>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'assistant',
    ...extra,
    message: {
      id,
      model: 'claude-opus-4-8',
      content: [{ type: 'text', text: 'CANARY_PROMPT_TEXT' }],
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        ...usage
      }
    }
  })
}
const fold = (...lines: string[]) => foldLines(emptyFold(), `${lines.join('\n')}\n`)

it('counts a message written on three lines once', () => {
  const usage = {
    input_tokens: 3,
    output_tokens: 40,
    cache_creation_input_tokens: 500,
    cache_read_input_tokens: 9000
  }
  expect(foldTotal(fold(line('m1', usage), line('m1', usage), line('m1', usage)))).toEqual({
    input: 3,
    output: 40,
    cacheWrite: 500,
    cacheRead: 9000
  })
})

it('takes the largest value of each field across streaming snapshots of one message', () => {
  const total = foldTotal(
    fold(
      line('m1', { output_tokens: 2, cache_read_input_tokens: 70 }),
      line('m1', { output_tokens: 2, cache_read_input_tokens: 70 }),
      line('m1', { output_tokens: 468, cache_read_input_tokens: 70 })
    )
  )
  expect(total).toMatchObject({ output: 468, cacheRead: 70 })
})

it('closes the previous message when a new id starts', () => {
  const total = foldTotal(
    fold(
      line('m1', { input_tokens: 1, output_tokens: 10 }),
      line('m1', { input_tokens: 1, output_tokens: 30 }),
      line('m2', { input_tokens: 2, output_tokens: 5 }),
      line('m3', { input_tokens: 4, output_tokens: 1 })
    )
  )
  expect(total).toMatchObject({ input: 7, output: 36 })
})

it('adds nothing for synthetic, non-assistant, unidentified or malformed lines', () => {
  const real = line('m1', { input_tokens: 5, output_tokens: 6 })
  const state = fold(
    real,
    JSON.stringify({ type: 'user', message: { id: 'u1', usage: { input_tokens: 999 } } }),
    JSON.stringify({
      type: 'assistant',
      message: { id: 'm2', model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } }
    }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 999 } } }),
    JSON.stringify({ type: 'assistant', message: { id: 'm3', usage: 'none' } }),
    JSON.stringify({
      type: 'assistant',
      message: {
        id: 'm4',
        content: [{ type: 'tool_use', input: { usage: { input_tokens: 999 } } }]
      }
    }),
    '{"type":"assistant","message":{"id":"m5","usage":{"input_tokens":999',
    line('m6', { input_tokens: -4, output_tokens: Number.NaN })
  )
  expect(foldTotal(state)).toEqual({ input: 5, output: 6, cacheWrite: 0, cacheRead: 0 })
})

it('gives the same totals whether the text arrives whole or split inside a message', () => {
  const lines = [
    line('m1', { output_tokens: 2 }),
    line('m1', { output_tokens: 90 }),
    line('m2', { input_tokens: 8, cache_read_input_tokens: 100 }),
    line('m2', { input_tokens: 8, cache_read_input_tokens: 100, output_tokens: 7 })
  ]
  const whole = fold(...lines)
  const firstHalf = fold(lines[0])
  const halves = foldLines(foldLines(firstHalf, `${lines[1]}\n${lines[2]}\n`), `${lines[3]}\n`)
  expect(foldTotal(halves)).toEqual(foldTotal(whole))
  expect(foldTotal(whole)).toEqual({ input: 8, output: 97, cacheWrite: 0, cacheRead: 100 })
})

it('reports the window of the latest message as context, and none before any message', () => {
  expect(contextTokens(emptyFold())).toBeNull()
  const state = fold(
    line('m1', { input_tokens: 9, cache_read_input_tokens: 9, cache_creation_input_tokens: 9 }),
    line('m2', {
      input_tokens: 2,
      cache_read_input_tokens: 300,
      cache_creation_input_tokens: 40,
      output_tokens: 1000
    })
  )
  expect(contextTokens(state)).toBe(342)
})

it('keeps numbers and the message id only, never transcript text', () => {
  const state = fold(line('m1', { input_tokens: 1 }, { cwd: '/CANARY_PATH' }))
  expect(JSON.stringify(state)).not.toMatch(/CANARY/)
})
