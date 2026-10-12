import { beforeEach, expect, it, vi } from 'vitest'

const PIN_KEY = 'claudewatch.office.quality'
const ON_TIME_MS = 1000 / 30

// The store is one per page: each test loads its own.
async function loadStore() {
  vi.resetModules()
  return import('../quality-store')
}

beforeEach(() => {
  window.localStorage.clear()
  // The test machine's own core count must not decide the starting level.
  vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
})

it('starts on auto at the level the machine suggests', async () => {
  const store = await loadStore()
  expect(store.readQuality()).toEqual({ pin: 'auto', chosen: 'full' })
})

it('remembers a pinned level across page loads', async () => {
  const first = await loadStore()
  first.pinQuality('light')
  expect(window.localStorage.getItem(PIN_KEY)).toBe('light')
  const second = await loadStore()
  expect(second.readQuality().pin).toBe('light')
})

it('tells its subscribers when the pin or the chosen level changes', async () => {
  const store = await loadStore()
  const onChange = vi.fn()
  const unsubscribe = store.subscribeQuality(onChange)
  store.pinQuality('balanced')
  store.chooseQuality('light')
  expect(onChange).toHaveBeenCalledTimes(2)
  store.chooseQuality('light')
  expect(onChange).toHaveBeenCalledTimes(2)
  unsubscribe()
  store.pinQuality('auto')
  expect(onChange).toHaveBeenCalledTimes(2)
})

it('steps the chosen level down when watched frames keep arriving late', async () => {
  const store = await loadStore()
  for (let timeMs = 0; timeMs <= 8_000; timeMs += 60)
    store.watchQuality({ timeMs, intervalMs: 60, targetFps: 30 })
  expect(store.readQuality().chosen).toBe('balanced')
})

it('leaves a pinned level alone, however late the frames', async () => {
  const store = await loadStore()
  store.pinQuality('full')
  for (let timeMs = 0; timeMs <= 20_000; timeMs += 60)
    store.watchQuality({ timeMs, intervalMs: 60, targetFps: 30 })
  expect(store.readQuality()).toEqual({ pin: 'full', chosen: 'full' })
})

it('starts watching afresh when the owner returns to auto', async () => {
  const store = await loadStore()
  for (let timeMs = 0; timeMs <= 4_000; timeMs += 60)
    store.watchQuality({ timeMs, intervalMs: 60, targetFps: 30 })
  store.pinQuality('full')
  store.watchQuality({ timeMs: 4_100, intervalMs: 60, targetFps: 30 })
  store.pinQuality('auto')
  // The late frames from before the pin no longer count.
  for (let timeMs = 4_200; timeMs <= 6_000; timeMs += ON_TIME_MS)
    store.watchQuality({ timeMs, intervalMs: ON_TIME_MS, targetFps: 30 })
  expect(store.readQuality().chosen).toBe('full')
})
