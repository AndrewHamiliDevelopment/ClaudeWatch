import { describe, expect, it } from 'vitest'
import { commandForKey, type KeyInput } from '../logic/hotkeys'

function key(value: string, overrides: Partial<KeyInput> = {}): KeyInput {
  return {
    key: value,
    hasModifier: false,
    isTargetEditable: false,
    isTargetInteractive: false,
    ...overrides
  }
}

describe('commandForKey', () => {
  it('maps the walls keys', () => {
    expect(commandForKey(key('Home'))).toEqual({ type: 'walls', mode: 'up' })
    expect(commandForKey(key('w'))).toEqual({ type: 'walls', mode: 'cutaway' })
    expect(commandForKey(key('End'))).toEqual({ type: 'walls', mode: 'down' })
  })

  it('maps queue, list, company and rotation keys', () => {
    expect(commandForKey(key('n'))).toEqual({ type: 'next-attention' })
    expect(commandForKey(key('L'))).toEqual({ type: 'toggle-list' })
    expect(commandForKey(key('['))).toBeNull()
    expect(commandForKey(key(']'))).toBeNull()
    expect(commandForKey(key('3'))).toEqual({ type: 'company-number', number: 3 })
    expect(commandForKey(key('q'))).toEqual({ type: 'rotate', direction: -1 })
    expect(commandForKey(key('e'))).toEqual({ type: 'rotate', direction: 1 })
  })

  it('focuses the selected agent terminal on F', () => {
    expect(commandForKey(key('f'))).toEqual({ type: 'focus-terminal' })
    expect(commandForKey(key('F'))).toEqual({ type: 'focus-terminal' })
    expect(commandForKey(key('f', { isTargetEditable: true }))).toBeNull()
  })

  it('gives the wheel zoom bands a keyboard alternative', () => {
    expect(commandForKey(key('-'))).toEqual({ type: 'zoom', direction: 'out' })
    expect(commandForKey(key('='))).toEqual({ type: 'zoom', direction: 'in' })
    expect(commandForKey(key('+'))).toEqual({ type: 'zoom', direction: 'in' })
  })

  it('flies on Enter only when no button has focus', () => {
    expect(commandForKey(key('Enter'))).toEqual({ type: 'fly-to-selected' })
    expect(commandForKey(key('Enter', { isTargetInteractive: true }))).toBeNull()
  })

  it('ignores keys with modifiers or typed into fields', () => {
    expect(commandForKey(key('w', { hasModifier: true }))).toBeNull()
    expect(commandForKey(key('w', { isTargetEditable: true }))).toBeNull()
    expect(commandForKey(key('0'))).toBeNull()
  })
})

describe('commandForKey while walking', () => {
  it('toggles walking with G, walking or not', () => {
    expect(commandForKey(key('g'))).toEqual({ type: 'toggle-walk' })
    expect(commandForKey(key('G'), true)).toEqual({ type: 'toggle-walk' })
  })

  it('leaves W A S D to the player, so W no longer cuts the walls away', () => {
    for (const letter of ['w', 'W', 'a', 's', 'd'])
      expect(commandForKey(key(letter), true)).toBeNull()
  })

  it('keeps every other key doing what it does', () => {
    expect(commandForKey(key('q'), true)).toEqual({ type: 'rotate', direction: -1 })
    expect(commandForKey(key('Home'), true)).toEqual({ type: 'walls', mode: 'up' })
    expect(commandForKey(key('Enter'), true)).toEqual({ type: 'fly-to-selected' })
  })
})
