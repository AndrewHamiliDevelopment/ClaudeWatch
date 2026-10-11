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

  it('maps queue, list, floors and rotation keys', () => {
    expect(commandForKey(key('n'))).toEqual({ type: 'next-attention' })
    expect(commandForKey(key('L'))).toEqual({ type: 'toggle-list' })
    expect(commandForKey(key('['))).toEqual({ type: 'floor-step', delta: -1 })
    expect(commandForKey(key(']'))).toEqual({ type: 'floor-step', delta: 1 })
    expect(commandForKey(key('3'))).toEqual({ type: 'floor-number', number: 3 })
    expect(commandForKey(key('q'))).toEqual({ type: 'rotate', direction: -1 })
    expect(commandForKey(key('e'))).toEqual({ type: 'rotate', direction: 1 })
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
