import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { makeAgent, makeSession } from '../__tests__/fixtures'
import { Inspector } from './Inspector'

const START_MS = 1_700_000_000_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START_MS + 5_000)
})
afterEach(() => vi.useRealTimers())

const elapsed = (): string | null =>
  screen.getByText('Elapsed', { selector: 'dt' }).nextElementSibling?.textContent ?? null

it('counts the elapsed time on by itself, with no new props from the Office', () => {
  render(
    <Inspector
      agent={makeAgent({ agentKey: 'claude:a' })}
      session={makeSession({ key: 'claude:a', startedAtMs: START_MS })}
      member={undefined}
      character={null}
      canFly={false}
      onFocusTerminal={() => undefined}
      onFly={() => undefined}
      onClose={() => undefined}
    />
  )
  expect(elapsed()).toBe('0:05')
  act(() => vi.advanceTimersByTime(2_000))
  expect(elapsed()).toBe('0:07')
})
