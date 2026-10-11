import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useOfficeTheme } from '../hooks'
import { useOfficeHotkeys } from '../use-office-effects'
import { BottomBar } from '../hud/BottomBar'
import { listThemes, themeForTeam } from '../themes/registry'

beforeEach(() => localStorage.clear())

it('uses the team default and falls back for unknown stored ids', () => {
  localStorage.setItem('claudewatch.office.theme', 'missing')
  const { result } = renderHook(useOfficeTheme)
  expect(result.current.theme.id).toBe(themeForTeam().id)
})

it('restores a registered theme, cycles in registry order and persists', () => {
  const lastThemeId = listThemes().at(-1)?.id ?? ''
  localStorage.setItem('claudewatch.office.theme', lastThemeId)
  const { result } = renderHook(useOfficeTheme)
  expect(result.current.theme.id).toBe(lastThemeId)
  act(() => result.current.cycleTheme())
  expect(result.current.theme.id).toBe('neo-edo-steam')
  expect(localStorage.getItem('claudewatch.office.theme')).toBe('neo-edo-steam')
})

it('cycles from T without dispatching a reducer action or intercepting editable input', () => {
  const dispatch = vi.fn()
  const cycle = vi.fn()
  renderHook(() =>
    useOfficeHotkeys(dispatch, false, { onCycleTheme: cycle, onFocusTerminal: vi.fn() })
  )
  fireEvent.keyDown(window, { key: 'T' })
  expect(cycle).toHaveBeenCalledTimes(1)
  expect(dispatch).not.toHaveBeenCalled()
  const input = document.createElement('input')
  document.body.append(input)
  fireEvent.keyDown(input, { key: 't' })
  expect(cycle).toHaveBeenCalledTimes(1)
  input.remove()
})

it('exposes the current theme and cycles from the BottomBar', () => {
  const cycle = vi.fn()
  render(
    <BottomBar
      wallsMode="cutaway"
      isListView={false}
      is3DAvailable
      isMetricsVisible={false}
      onWallsMode={vi.fn()}
      onToggleList={vi.fn()}
      onToggleMetrics={vi.fn()}
      themeScope={null}
      themeLabel="Neo Edo Steam"
      onCycleTheme={cycle}
      onRotate={vi.fn()}
      onZoom={vi.fn()}
      onFit={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Theme: Neo Edo Steam/ }))
  expect(cycle).toHaveBeenCalledOnce()
})
