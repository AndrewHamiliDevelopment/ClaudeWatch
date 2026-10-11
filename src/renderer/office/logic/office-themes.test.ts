import { describe, expect, it, vi } from 'vitest'
import {
  createOfficeThemeStore,
  EMPTY_THEME_ASSIGNMENTS,
  OFFICE_THEMES_STORAGE_KEY,
  parseThemeAssignments,
  resolveTheme,
  type ThemeStorage
} from './office-themes'
import { getTheme } from '../themes/registry'

const EDO = 'neo-edo-steam'
const BRASS = 'brass-workshop'

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & {
  values: Map<string, string>
} {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  }
}

describe('resolveTheme', () => {
  const assignments = {
    version: 1 as const,
    companies: { c_a: BRASS },
    projects: { p_override: EDO }
  }
  it('prefers the project override over the company default', () => {
    expect(resolveTheme({ companyKey: 'c_a', projectKey: 'p_override' }, assignments, BRASS)).toBe(
      EDO
    )
  })
  it('falls back to the company default when the project has no override', () => {
    expect(resolveTheme({ companyKey: 'c_a', projectKey: 'p_plain' }, assignments, EDO)).toBe(BRASS)
  })
  it('falls back to the global default when neither is assigned', () => {
    expect(resolveTheme({ companyKey: 'c_b', projectKey: 'p_plain' }, assignments, EDO)).toBe(EDO)
    expect(resolveTheme({ companyKey: null, projectKey: null }, assignments, BRASS)).toBe(BRASS)
  })
  it('never reads an inherited object member as an assignment', () => {
    expect(
      resolveTheme({ companyKey: 'constructor', projectKey: 'toString' }, assignments, EDO)
    ).toBe(EDO)
  })
})

describe('parseThemeAssignments', () => {
  it('keeps known theme ids for companies and projects', () => {
    const stored = { version: 1, companies: { c_a: BRASS }, projects: { p_a: EDO } }
    expect(parseThemeAssignments(JSON.stringify(stored))).toEqual(stored)
  })
  it.each([
    ['null', null],
    ['not JSON', '{nope'],
    ['a number', '7'],
    ['an array', '[1,2]'],
    ['a string', '"brass-workshop"'],
    ['another version', JSON.stringify({ version: 2, companies: { c_a: BRASS }, projects: {} })]
  ])('reads %s as no assignments', (_name, raw) => {
    expect(parseThemeAssignments(raw)).toEqual(EMPTY_THEME_ASSIGNMENTS)
  })
  it('drops unknown theme ids and wrong value types, keeping the valid entries', () => {
    const raw = JSON.stringify({
      version: 1,
      companies: { c_a: BRASS, c_b: 'no-such-theme', c_c: 4, c_d: null },
      projects: ['p_a'],
      extra: true
    })
    expect(parseThemeAssignments(raw)).toEqual({
      version: 1,
      companies: { c_a: BRASS },
      projects: {}
    })
  })
})

describe('office theme store', () => {
  it('starts from the stored assignments', () => {
    const storage = memoryStorage({
      [OFFICE_THEMES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        companies: { c_a: BRASS },
        projects: {}
      })
    })
    const store = createOfficeThemeStore(storage)
    expect(store.getThemeFor({ companyKey: 'c_a', projectKey: 'p_a' }, getTheme(EDO)).id).toBe(
      BRASS
    )
    expect(store.getThemeFor({ companyKey: 'c_b', projectKey: 'p_b' }, getTheme(EDO)).id).toBe(EDO)
  })
  it('persists a company theme and a project override, and notifies subscribers', () => {
    const storage = memoryStorage()
    const store = createOfficeThemeStore(storage)
    const listener = vi.fn()
    store.subscribe(listener)
    store.setCompanyTheme('c_a', BRASS)
    store.setProjectTheme('p_a', EDO)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(JSON.parse(storage.values.get(OFFICE_THEMES_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      companies: { c_a: BRASS },
      projects: { p_a: EDO }
    })
    expect(createOfficeThemeStore(storage).getAssignments()).toEqual(store.getAssignments())
  })
  it('clearing a project override returns it to its company theme', () => {
    const store = createOfficeThemeStore(memoryStorage())
    store.setCompanyTheme('c_a', BRASS)
    store.setProjectTheme('p_a', EDO)
    store.clearProjectTheme('p_a')
    expect(store.getThemeFor({ companyKey: 'c_a', projectKey: 'p_a' }, getTheme(EDO)).id).toBe(
      BRASS
    )
    store.clearCompanyTheme('c_a')
    expect(store.getAssignments()).toEqual(EMPTY_THEME_ASSIGNMENTS)
  })
  it('refuses an unknown theme id or an empty key on write', () => {
    const storage = memoryStorage()
    const store = createOfficeThemeStore(storage)
    const listener = vi.fn()
    store.subscribe(listener)
    store.setCompanyTheme('c_a', 'no-such-theme')
    store.setProjectTheme('', BRASS)
    expect(store.getAssignments()).toEqual(EMPTY_THEME_ASSIGNMENTS)
    expect(listener).not.toHaveBeenCalled()
    expect(storage.values.has(OFFICE_THEMES_STORAGE_KEY)).toBe(false)
  })
  it('keeps the same snapshot until an assignment changes', () => {
    const store = createOfficeThemeStore(memoryStorage())
    const before = store.getAssignments()
    expect(store.getAssignments()).toBe(before)
    store.clearProjectTheme('p_missing')
    expect(store.getAssignments()).toBe(before)
    store.setCompanyTheme('c_a', BRASS)
    expect(store.getAssignments()).not.toBe(before)
  })
  it('stops notifying after unsubscribe', () => {
    const store = createOfficeThemeStore(memoryStorage())
    const listener = vi.fn()
    store.subscribe(listener)()
    store.setCompanyTheme('c_a', BRASS)
    expect(listener).not.toHaveBeenCalled()
  })
  it('still works when storage throws on read and on write', () => {
    const store = createOfficeThemeStore({
      getItem: () => {
        throw new Error('locked')
      },
      setItem: () => {
        throw new Error('locked')
      }
    })
    store.setCompanyTheme('c_a', BRASS)
    expect(store.getAssignments().companies).toEqual({ c_a: BRASS })
  })
})
