import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, getTheme, listThemes, registerTheme, themeForTeam } from './registry'

describe('theme registry', () => {
  it('registers both built-ins and defaults the floor and unknown ids to Neo Edo', () => {
    expect(DEFAULT_THEME_ID).toBe('neo-edo-steam')
    expect(
      listThemes()
        .map((theme) => theme.id)
        .slice(0, 2)
    ).toEqual(['neo-edo-steam', 'brass-workshop'])
    expect(getTheme('brass-workshop').id).toBe('brass-workshop')
    expect(getTheme('missing')).toBe(getTheme(DEFAULT_THEME_ID))
    expect(themeForTeam()).toBe(getTheme(DEFAULT_THEME_ID))
  })
  it('provides every kit, world and provider member', () => {
    for (const theme of listThemes()) {
      expect(theme.label.length).toBeGreaterThan(0)
      expect(theme.description.length).toBeGreaterThan(0)
      expect(typeof theme.robot.Model).toBe('function')
      for (const key of ['Slab', 'Elevator']) {
        expect(typeof Reflect.get(theme.kit.floor, key)).toBe('function')
      }
      for (const key of [
        'CompanyZone',
        'ProjectOffice',
        'RoomFloors',
        'Walls',
        'Doorway',
        'Desk',
        'RoomDressing',
        'RoomSign'
      ]) {
        expect(typeof Reflect.get(theme.kit.zone, key)).toBe('function')
      }
      for (const key of ['District', 'Hangar', 'Tower']) {
        expect(typeof Reflect.get(theme.world, key)).toBe('function')
      }
      for (const provider of ['claude', 'codex'] as const) {
        expect(theme.robot.skins[provider]).toMatchObject({
          body: expect.any(String),
          trim: expect.any(String),
          eye: expect.any(String)
        })
      }
    }
  })
  it('rejects duplicate ids and protects the list from caller mutation', () => {
    expect(() => registerTheme(getTheme(DEFAULT_THEME_ID))).toThrow('already registered')
    const copy = listThemes()
    copy.pop()
    expect(listThemes()).toHaveLength(copy.length + 1)
  })
  it('can register a future team theme', () => {
    const theme = { ...getTheme(DEFAULT_THEME_ID), id: 'test-team' }
    registerTheme(theme)
    expect(getTheme('test-team')).toBe(theme)
  })
})
