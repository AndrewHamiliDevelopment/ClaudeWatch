import { expect, it } from 'vitest'
import { accountKey } from './account-key'

const PROVIDER_ID = 'b3c1f6a2-0000-4000-8000-00000000cafe'

it('names an account by a short one-way hash of its provider id', () => {
  const key = accountKey('claude', PROVIDER_ID)
  expect(key).toMatch(/^claude:[0-9a-f]{12}$/)
  expect(key).toBe(accountKey('claude', PROVIDER_ID))
  expect(key).not.toContain(PROVIDER_ID.slice(0, 8))
})

it('keeps providers and accounts apart', () => {
  expect(accountKey('codex', PROVIDER_ID)).not.toBe(accountKey('claude', PROVIDER_ID))
  expect(accountKey('claude', `${PROVIDER_ID}x`)).not.toBe(accountKey('claude', PROVIDER_ID))
})
