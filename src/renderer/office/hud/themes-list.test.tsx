import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeAgent,
  makeFloor,
  makeFrame,
  makeRoom,
  makeSession,
  makeZone
} from '../__tests__/fixtures'
import { officeThemes } from '../logic/office-themes'
import { resetHud, setupHud } from './hud-test-harness'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => false }))

beforeEach(resetHud)

const OFFICES = [
  { companyKey: 'c_a', companyLabel: 'Alpha', projectKey: 'p_a', projectLabel: 'Api' },
  { companyKey: 'c_b', companyLabel: 'Beta', projectKey: 'p_b', projectLabel: 'Web' },
  { companyKey: 'c_c', companyLabel: 'Gamma', projectKey: 'p_c', projectLabel: 'Ops' }
]

// Three companies with one project and one agent each.
const frame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'one',
      zones: OFFICES.map((office) =>
        makeZone({
          id: `z-${office.companyKey}`,
          kind: 'company',
          label: office.companyLabel,
          companyKey: office.companyKey,
          children: [
            makeZone({
              id: `z-${office.projectKey}`,
              kind: 'project',
              label: office.projectLabel,
              companyKey: office.companyKey,
              projectKey: office.projectKey
            })
          ]
        })
      ),
      rooms: OFFICES.map((office) =>
        makeRoom({ id: `r-${office.projectKey}`, sessionKey: `claude:${office.projectKey}` })
      )
    })
  ],
  sessions: OFFICES.map((office) => makeSession({ ...office, key: `claude:${office.projectKey}` })),
  agents: OFFICES.map((office) =>
    makeAgent({
      agentKey: `claude:${office.projectKey}`,
      floorId: 'one',
      roomId: `r-${office.projectKey}`
    })
  )
})

const barButton = (themeLabel: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^Floor theme: ${themeLabel}`) })

function openList(themeLabel = 'Neo Edo Steam'): HTMLElement {
  fireEvent.click(barButton(themeLabel))
  return screen.getByRole('dialog', { name: 'Office themes' })
}

function choose(list: HTMLElement, rowName: RegExp, themeLabel: string | RegExp): void {
  fireEvent.click(within(list).getByRole('button', { name: rowName }))
  fireEvent.click(within(list).getByRole('radio', { name: themeLabel }))
}

describe('themes list', () => {
  it('opens from the bar button, which changes no theme by itself', () => {
    setupHud(undefined, { frame })
    const list = openList()
    expect(barButton('Neo Edo Steam')).toHaveAttribute('aria-expanded', 'true')
    expect(list.contains(document.activeElement)).toBe(true)
    expect(officeThemes.getAssignments()).toMatchObject({ companies: {}, projects: {} })
    expect(localStorage.getItem('claudewatch.office.theme')).toBeNull()
    for (const name of [
      "Every office: Neo Edo Steam, the floor's theme",
      'Alpha: Neo Edo Steam, follows the floor',
      'Api: Neo Edo Steam, follows Alpha'
    ])
      expect(within(list).getByRole('button', { name })).toBeInTheDocument()
  })

  it('gives three companies three themes and names each one', () => {
    setupHud(undefined, { frame })
    const list = openList()
    choose(list, /^Alpha:/, 'Brass Workshop')
    choose(list, /^Beta:/, 'Violet Court')
    choose(list, /^Gamma:/, 'Quiet Grove')
    expect(officeThemes.getAssignments().companies).toEqual({
      c_a: 'brass-workshop',
      c_b: 'violet-court',
      c_c: 'quiet-grove'
    })
    for (const name of [
      'Alpha: Brass Workshop, its own choice',
      'Api: Brass Workshop, follows Alpha',
      'Beta: Violet Court, its own choice',
      'Gamma: Quiet Grove, its own choice'
    ])
      expect(within(list).getByRole('button', { name })).toBeInTheDocument()
    expect(barButton('Neo Edo Steam')).toBeInTheDocument()
  })

  it('announces which office changed and that the others did not', () => {
    setupHud(undefined, { frame })
    choose(openList(), /^Web:/, 'Violet Court')
    const notice = screen.getByText(
      'Web office is now Violet Court. Other offices keep their themes.'
    )
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
    expect(officeThemes.getAssignments()).toMatchObject({
      companies: {},
      projects: { p_b: 'violet-court' }
    })
  })

  it('says what setting every office removes before it removes it', () => {
    setupHud(undefined, { frame })
    act(() => {
      officeThemes.setCompanyTheme('c_a', 'brass-workshop')
      officeThemes.setProjectTheme('p_b', 'violet-court')
    })
    const list = openList()
    choose(list, /^Every office:/, 'Quiet Grove')
    expect(within(list).getByText(/removes the 2 company and project choices/)).toBeInTheDocument()
    expect(officeThemes.getAssignments().companies).toEqual({ c_a: 'brass-workshop' })

    fireEvent.click(within(list).getByRole('button', { name: 'Set every office to Quiet Grove' }))
    expect(officeThemes.getAssignments()).toMatchObject({ companies: {}, projects: {} })
    expect(localStorage.getItem('claudewatch.office.theme')).toBe('quiet-grove')
    expect(barButton('Quiet Grove')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Every office is now Quiet Grove. 2 company and project choices were removed.'
      )
    ).toBeInTheDocument()
    expect(
      within(list).getByRole('button', { name: 'Alpha: Quiet Grove, follows the floor' })
    ).toBeInTheDocument()
  })

  it('sets every office at once when no office has a choice to lose', () => {
    setupHud(undefined, { frame })
    choose(openList(), /^Every office:/, 'Brass Workshop')
    expect(barButton('Brass Workshop')).toBeInTheDocument()
    expect(screen.getByText('Every office is now Brass Workshop.')).toBeInTheDocument()
  })

  it('puts one project back to following its company', () => {
    setupHud(undefined, { frame })
    act(() => {
      officeThemes.setCompanyTheme('c_a', 'brass-workshop')
      officeThemes.setProjectTheme('p_a', 'violet-court')
    })
    const list = openList()
    choose(list, /^Api: Violet Court, its own choice/, 'Follow Alpha (Brass Workshop)')
    expect(officeThemes.getAssignments().projects).toEqual({})
    expect(
      within(list).getByRole('button', { name: 'Api: Brass Workshop, follows Alpha' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Api office now follows its company: Brass Workshop. Other offices keep their themes.'
      )
    ).toBeInTheDocument()
  })

  it('closes a choice, then the list, on Escape and hands focus back each time', () => {
    setupHud(undefined, { frame })
    const list = openList()
    const row = within(list).getByRole('button', { name: /^Beta:/ })
    fireEvent.click(row)
    fireEvent.keyDown(within(list).getByRole('group', { name: 'Theme for Beta' }), {
      key: 'Escape'
    })
    expect(within(list).queryByRole('group', { name: 'Theme for Beta' })).toBeNull()
    expect(row).toHaveFocus()

    fireEvent.keyDown(row, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Office themes' })).toBeNull()
    expect(barButton('Neo Edo Steam')).toHaveFocus()
    expect(barButton('Neo Edo Steam')).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays available on a page that may only watch', () => {
    setupHud(undefined, { frame, isViewOnly: true })
    choose(openList(), /^Gamma:/, 'Orbital Garrison')
    expect(officeThemes.getAssignments().companies).toEqual({ c_c: 'orbital-garrison' })
  })
})
