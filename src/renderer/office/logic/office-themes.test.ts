import { describe, expect, it, vi } from 'vitest'
import { makeFloor, makeZone } from '../__tests__/fixtures'
import {
  buildThemeRows,
  createOfficeThemeStore,
  EMPTY_THEME_ASSIGNMENTS,
  everyOfficeNotice,
  groupZonesByTheme,
  OFFICE_THEMES_STORAGE_KEY,
  parseThemeAssignments,
  resolveTheme,
  themeChangeNotice,
  type ThemeStorage
} from './office-themes'

const EDO = 'neo-edo-steam'
const BRASS = 'brass-workshop'
const VIOLET = 'violet-court'
const GROVE = 'quiet-grove'

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
    const assignments = store.getAssignments()
    expect(resolveTheme({ companyKey: 'c_a', projectKey: 'p_a' }, assignments, EDO)).toBe(BRASS)
    expect(resolveTheme({ companyKey: 'c_b', projectKey: 'p_b' }, assignments, EDO)).toBe(EDO)
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
    expect(
      resolveTheme({ companyKey: 'c_a', projectKey: 'p_a' }, store.getAssignments(), EDO)
    ).toBe(BRASS)
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
  it('keeps the in-memory choices when nothing can be saved', () => {
    const store = createOfficeThemeStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      }
    })
    store.setCompanyTheme('c_a', BRASS)
    store.setCompanyTheme('c_b', EDO)
    expect(store.getAssignments().companies).toEqual({ c_a: BRASS, c_b: EDO })
  })
})

describe('two Office pages on one origin', () => {
  const saved = (storage: ReturnType<typeof memoryStorage>): unknown =>
    JSON.parse(storage.values.get(OFFICE_THEMES_STORAGE_KEY) ?? 'null')

  it('keeps the theme the other page saved since this one loaded', () => {
    const storage = memoryStorage()
    const pageA = createOfficeThemeStore(storage)
    const pageB = createOfficeThemeStore(storage)
    pageA.setCompanyTheme('c_one', BRASS)
    pageB.setCompanyTheme('c_two', EDO)
    expect(saved(storage)).toMatchObject({ companies: { c_one: BRASS, c_two: EDO } })
    expect(pageB.getAssignments().companies).toEqual({ c_one: BRASS, c_two: EDO })
  })

  it('does not bring back a theme the other page cleared', () => {
    const storage = memoryStorage()
    const pageA = createOfficeThemeStore(storage)
    pageA.setCompanyTheme('c_one', BRASS)
    const pageB = createOfficeThemeStore(storage)
    pageA.clearCompanyTheme('c_one')
    pageB.setProjectTheme('p_two', EDO)
    expect(saved(storage)).toMatchObject({ companies: {}, projects: { p_two: EDO } })
  })

  it('follows a change the other page saves, while something is subscribed', () => {
    const storage = memoryStorage()
    const pageA = createOfficeThemeStore(storage, window)
    const pageB = createOfficeThemeStore(storage)
    const listener = vi.fn()
    const unsubscribe = pageA.subscribe(listener)
    const announce = (key: string | null): void =>
      void window.dispatchEvent(
        new StorageEvent('storage', { key, newValue: storage.values.get(key ?? '') ?? null })
      )

    pageB.setCompanyTheme('c_two', EDO)
    announce('some.other.key')
    expect(listener).not.toHaveBeenCalled()
    announce(OFFICE_THEMES_STORAGE_KEY)
    expect(pageA.getAssignments().companies).toEqual({ c_two: EDO })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    pageB.setCompanyTheme('c_three', BRASS)
    announce(OFFICE_THEMES_STORAGE_KEY)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps its snapshot when a storage event repeats what it already holds', () => {
    const storage = memoryStorage()
    const store = createOfficeThemeStore(storage, window)
    store.setCompanyTheme('c_a', BRASS)
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.getAssignments()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: OFFICE_THEMES_STORAGE_KEY,
        newValue: storage.values.get(OFFICE_THEMES_STORAGE_KEY) ?? null
      })
    )
    expect(store.getAssignments()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('a theme per company', () => {
  const companyZone = (key: string, projectKey: string) =>
    makeZone({
      id: `z-${key}`,
      kind: 'company',
      companyKey: key,
      children: [makeZone({ id: `z-${projectKey}`, kind: 'project', companyKey: key, projectKey })]
    })
  const floor = makeFloor({
    floorId: 'one',
    zones: [companyZone('c_a', 'p_a'), companyZone('c_b', 'p_b'), companyZone('c_c', 'p_c')]
  })
  const companies = [
    { companyKey: 'c_a', label: 'Alpha', projects: [{ projectKey: 'p_a', label: 'Api' }] },
    { companyKey: 'c_b', label: 'Beta', projects: [{ projectKey: 'p_b', label: 'Web' }] },
    { companyKey: 'c_c', label: 'Gamma', projects: [{ projectKey: 'p_c', label: 'Ops' }] }
  ]

  it('draws three companies in three themes once each has its own', () => {
    const store = createOfficeThemeStore(memoryStorage())
    store.setCompanyTheme('c_a', BRASS)
    store.setCompanyTheme('c_b', VIOLET)
    store.setCompanyTheme('c_c', GROVE)
    const assignments = store.getAssignments()
    const themeOf = (companyKey: string): string =>
      resolveTheme({ companyKey, projectKey: null }, assignments, EDO)
    expect(['c_a', 'c_b', 'c_c'].map(themeOf)).toEqual([BRASS, VIOLET, GROVE])
    const groups = groupZonesByTheme(floor, (zone) => resolveTheme(zone, assignments, EDO))
    expect(
      groups.map((group) => [group.themeId, group.companies[0]?.companyKey, group.projects.length])
    ).toEqual([
      [BRASS, 'c_a', 1],
      [VIOLET, 'c_b', 1],
      [GROVE, 'c_c', 1]
    ])
  })

  it('lists each office with its theme and whom it follows', () => {
    const assignments = {
      version: 1 as const,
      companies: { c_a: BRASS },
      projects: { p_b: VIOLET }
    }
    const [alpha, beta] = buildThemeRows(companies, assignments, EDO)
    expect(alpha).toMatchObject({ themeId: BRASS, ownThemeId: BRASS, inheritedThemeId: EDO })
    expect(alpha.projects[0]).toMatchObject({
      target: { companyKey: 'c_a', projectKey: 'p_a', label: 'Api' },
      themeId: BRASS,
      ownThemeId: null,
      followsLabel: 'Alpha',
      inheritedThemeId: BRASS
    })
    expect(beta).toMatchObject({ themeId: EDO, ownThemeId: null, followsLabel: 'the floor' })
    expect(beta.projects[0]).toMatchObject({ themeId: VIOLET, ownThemeId: VIOLET })
  })

  it('clears every company and project choice at once, here and in storage', () => {
    const storage = memoryStorage()
    const store = createOfficeThemeStore(storage)
    store.setCompanyTheme('c_a', BRASS)
    store.setProjectTheme('p_b', VIOLET)
    store.clearAll()
    expect(store.getAssignments()).toEqual(EMPTY_THEME_ASSIGNMENTS)
    expect(createOfficeThemeStore(storage).getAssignments()).toEqual(EMPTY_THEME_ASSIGNMENTS)
  })
})

describe('theme change notices', () => {
  const project = { companyKey: 'c_a', projectKey: 'p_a', label: 'ClaudeWatch' }
  const company = { companyKey: 'c_a', projectKey: null, label: 'ZKidz' }

  it('names the one office that changed and says the others did not', () => {
    expect(themeChangeNotice(project, 'Violet Court', false)).toBe(
      'ClaudeWatch office is now Violet Court. Other offices keep their themes.'
    )
  })
  it('names a company and what it leaves alone', () => {
    expect(themeChangeNotice(company, 'Quiet Grove', false)).toBe(
      'ZKidz company is now Quiet Grove. Projects with their own theme and other companies keep theirs.'
    )
  })
  it('says whom an office follows once it is put back', () => {
    expect(themeChangeNotice(project, 'Quiet Grove', true)).toBe(
      'ClaudeWatch office now follows its company: Quiet Grove. Other offices keep their themes.'
    )
    expect(themeChangeNotice(company, 'Neo Edo Steam', true)).toMatch(
      /^ZKidz company now follows the floor: Neo Edo Steam\./
    )
  })
  it('says how many choices setting every office removed', () => {
    expect(everyOfficeNotice('Brass Workshop', 0)).toBe('Every office is now Brass Workshop.')
    expect(everyOfficeNotice('Brass Workshop', 1)).toBe(
      'Every office is now Brass Workshop. 1 company or project choice was removed.'
    )
    expect(everyOfficeNotice('Brass Workshop', 3)).toBe(
      'Every office is now Brass Workshop. 3 company and project choices were removed.'
    )
  })
})
