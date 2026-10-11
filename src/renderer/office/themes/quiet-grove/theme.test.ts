import { expect, it } from 'vitest'
import { CARD_STATUS_COLOR, STATE_COLOR } from '../../office-palette'
import { getTheme, listThemes } from '../registry'
import { GROVE, GROVE_GROUNDS } from './palette'
import { QUIET_GROVE_ID } from './roster'
import { quietGrove } from './index'

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

it('is registered under its own id with a label and a description', () => {
  expect(listThemes().map((theme) => theme.id)).toContain('quiet-grove')
  expect(getTheme(QUIET_GROVE_ID)).toBe(quietGrove)
  expect(quietGrove.label).toBe('Quiet Grove')
  expect(quietGrove.description.length).toBeGreaterThan(20)
})

it('tells the two providers apart by body colour and eye glow', () => {
  const { claude, codex } = quietGrove.robot.skins
  expect(claude.body).not.toBe(codex.body)
  expect(claude.eye).not.toBe(codex.eye)
  expect(claude.label).not.toBe(codex.label)
})

it('keeps the status colours for status', () => {
  const reserved = [...Object.values(STATE_COLOR), ...Object.values(CARD_STATUS_COLOR)].map(
    (color) => color.toLowerCase()
  )
  for (const color of Object.values(GROVE)) expect(reserved).not.toContain(color.toLowerCase())
})

// Name cards are white and the stand-in status dots wear a white ring (scene/NameCards.tsx):
// WCAG 1.4.11 asks 3:1 against whatever ground they float over.
it('keeps every ground dark enough for the white name cards and status rings', () => {
  expect(GROVE_GROUNDS.length).toBeGreaterThanOrEqual(4)
  for (const ground of GROVE_GROUNDS)
    expect(contrast('#FFFFFF', ground), `white on ${ground}`).toBeGreaterThanOrEqual(3)
})

it('signals needs-you in a colour no ground or other glow uses', () => {
  expect(GROVE_GROUNDS).not.toContain(GROVE.beacon)
  expect(GROVE.beacon).not.toBe(GROVE.lumen)
  for (const ground of GROVE_GROUNDS)
    expect(contrast(GROVE.beacon, ground), `beacon on ${ground}`).toBeGreaterThanOrEqual(3)
})
