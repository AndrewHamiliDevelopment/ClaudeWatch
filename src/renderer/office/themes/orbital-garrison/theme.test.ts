import { expect, it } from 'vitest'
import { STATE_COLOR } from '../../office-palette'
import { getTheme, listThemes } from '../registry'
import { GARRISON } from './palette'
import { ORBITAL_GARRISON_ID } from './roster'
import { orbitalGarrison } from './index'

it('is registered under its own id with a label and a description', () => {
  expect(listThemes().map((theme) => theme.id)).toContain('orbital-garrison')
  expect(getTheme(ORBITAL_GARRISON_ID)).toBe(orbitalGarrison)
  expect(orbitalGarrison.label).toBe('Orbital Garrison')
  expect(orbitalGarrison.description.length).toBeGreaterThan(20)
})

it('tells the two providers apart by suit colour', () => {
  const { claude, codex } = orbitalGarrison.robot.skins
  expect(claude.body).not.toBe(codex.body)
  expect(claude.label).not.toBe(codex.label)
})

it('keeps the status colours for status', () => {
  const reserved = Object.values(STATE_COLOR).map((color) => color.toLowerCase())
  for (const color of Object.values(GARRISON)) expect(reserved).not.toContain(color.toLowerCase())
})
