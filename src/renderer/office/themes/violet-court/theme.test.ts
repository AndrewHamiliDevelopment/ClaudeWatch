import { expect, it } from 'vitest'
import { STATE_COLOR } from '../../office-palette'
import { getTheme, listThemes } from '../registry'
import { COURT } from './palette'
import { VIOLET_COURT_ID } from './roster'
import { violetCourt } from './index'

it('is registered under its own id with a label and a description', () => {
  expect(listThemes().map((theme) => theme.id)).toContain('violet-court')
  expect(getTheme(VIOLET_COURT_ID)).toBe(violetCourt)
  expect(violetCourt.label).toBe('Violet Court')
  expect(violetCourt.description.length).toBeGreaterThan(20)
})

it('tells the two providers apart by uniform colour', () => {
  const { claude, codex } = violetCourt.robot.skins
  expect(claude.body).not.toBe(codex.body)
  expect(claude.label).not.toBe(codex.label)
})

it('keeps the status colours for status', () => {
  const reserved = Object.values(STATE_COLOR).map((color) => color.toLowerCase())
  for (const color of Object.values(COURT)) expect(reserved).not.toContain(color.toLowerCase())
})
