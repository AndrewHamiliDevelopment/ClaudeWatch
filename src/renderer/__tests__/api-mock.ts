import { vi } from 'vitest'
import type { DeckApi } from '../deck/deck-api'

// Includes openOffice, focusSession and getOfficeSnapshot, which the preload is gaining.
type ElectronApi = DeckApi

// Tests override only the bridge methods they exercise; every other method is a
// mock that resolves to null, and `on*` subscriptions return a no-op unsubscribe.
export function mockApi(overrides: Partial<ElectronApi> = {}): ElectronApi {
  const fallbacks = new Map<PropertyKey, unknown>()
  const fallbackFor = (key: PropertyKey): unknown => {
    if (!fallbacks.has(key)) {
      const isSubscription = typeof key === 'string' && key.startsWith('on')
      fallbacks.set(key, isSubscription ? vi.fn(() => () => {}) : vi.fn().mockResolvedValue(null))
    }
    return fallbacks.get(key)
  }
  // The proxy supplies every member the overrides leave out, so the full type holds.
  return new Proxy(overrides as ElectronApi, {
    get: (target, key) => (key in target ? Reflect.get(target, key) : fallbackFor(key))
  })
}
