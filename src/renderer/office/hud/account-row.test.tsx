import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AccountRef, SessionRef } from '../../../shared/office/types'
import { makeAgent, makeSession } from '../__tests__/fixtures'
import { accountText } from './agent-facts'
import { Inspector } from './Inspector'

const accounts: AccountRef[] = [
  {
    key: 'claude:aaaa',
    provider: 'claude',
    label: 'Lantern Works',
    plan: 'Max 20x',
    isActive: true
  }
]

const session = (overrides: Partial<SessionRef> = {}): SessionRef =>
  makeSession({ key: 'claude:a', ...overrides })

function accountFact(selected: SessionRef, known: AccountRef[] | undefined): string | null {
  render(
    <Inspector
      agent={makeAgent({ agentKey: selected.key })}
      session={selected}
      member={undefined}
      accounts={known}
      character={null}
      canFly={false}
      onFocusTerminal={() => undefined}
      onFly={() => undefined}
      onClose={() => undefined}
    />
  )
  const term = screen.queryByText('Account', { selector: 'dt' })
  return term?.nextElementSibling?.textContent ?? null
}

describe('accountText', () => {
  it('is the label of the account the session names', () => {
    expect(
      accountText(session({ accountKey: 'claude:aaaa', accountConfidence: 'exact' }), accounts)
    ).toBe('Lantern Works')
  })

  it('says when the account was inferred', () => {
    expect(
      accountText(session({ accountKey: 'claude:aaaa', accountConfidence: 'inferred' }), accounts)
    ).toBe('Lantern Works (inferred)')
  })

  it('is nothing for an unattributed session, an unknown key or no accounts at all', () => {
    expect(accountText(session({ accountConfidence: 'unattributed' }), accounts)).toBeNull()
    expect(accountText(session({ accountKey: null }), accounts)).toBeNull()
    expect(accountText(session({ accountKey: 'claude:zzzz' }), accounts)).toBeNull()
    expect(accountText(session({ accountKey: 'claude:aaaa' }), undefined)).toBeNull()
    expect(accountText(undefined, accounts)).toBeNull()
  })
})

describe('the inspector’s Account row', () => {
  it('shows the label of the selected session’s account', () => {
    const selected = session({ accountKey: 'claude:aaaa', accountConfidence: 'inferred' })
    expect(accountFact(selected, accounts)).toBe('Lantern Works (inferred)')
  })

  it('is absent while the account is not known', () => {
    expect(accountFact(session(), accounts)).toBeNull()
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
  })
})
