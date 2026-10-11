import { CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AccountSummary, AliasResult } from '../../../shared/accounts'
import { PROVIDER_LABEL } from '../../office/office-palette'
import { tokensText } from '../../office/hud/tokens'
import { Plate } from '../deck/Plate'
import { AccountLimits } from './AccountLimits'
import { AccountName } from './AccountName'
import { accountDisplayName, splitWindow, USAGE_WINDOWS, windowTokens } from './account-view'
import { LedgerTable } from './LedgerTable'

const WINDOW_COLUMNS = ['Today', '7 days', 'Since tracking']
const PART_COLUMNS = ['Input', 'Output', 'Cache write', 'Cache read']

interface AccountCardProps {
  account: AccountSummary
  nowMs: number
  onRename: (alias: string | null) => Promise<AliasResult>
}

export function AccountCard({ account, nowMs, onRename }: AccountCardProps) {
  const name = accountDisplayName(account)
  const windows = USAGE_WINDOWS.map((usageWindow) => ({
    ...usageWindow,
    split: splitWindow(account.usage, usageWindow.key)
  }))

  return (
    <article aria-label={name}>
      <Plate faceClassName="flex flex-col gap-3 px-4 pb-4 pt-3">
        <header className="flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-3">
            <AccountName name={name} alias={account.alias} onRename={onRename} />
            {account.isActive && (
              <p className="inline-flex shrink-0 items-center gap-1 pt-1 text-xs font-semibold text-status-active">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                Signed in now
              </p>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            {PROVIDER_LABEL[account.provider]}
            {account.plan && `, ${account.plan} plan`}
          </p>
          {account.email && (
            <p className="truncate text-caption text-text-tertiary">{account.email}</p>
          )}
        </header>

        <CardSection title="Tokens">
          <LedgerTable
            label="Tokens"
            columns={['Total', 'Exact', 'Inferred']}
            leadCellClassName="font-semibold text-accent"
            rows={windows.map(({ key, label, split }) => ({
              key,
              name: label,
              cells: [tokensText(split.total), tokensText(split.exact), tokensText(split.inferred)]
            }))}
          />
          <details className="text-xs text-text-secondary">
            <summary className="w-fit cursor-pointer rounded-sm py-0.5 hover:text-text-primary">
              Input, output and cache
            </summary>
            <div className="pt-1">
              <LedgerTable
                label="Token parts"
                columns={PART_COLUMNS}
                rows={windows.map(({ key, label, split: { parts } }) => ({
                  key,
                  name: label,
                  cells: [parts?.input, parts?.output, parts?.cacheWrite, parts?.cacheRead].map(
                    (part) => tokensText(part ?? null)
                  )
                }))}
              />
            </div>
          </details>
        </CardSection>

        <CardSection title="Projects">
          {account.projects.length === 0 ? (
            <p className="text-xs text-text-secondary">No project counted yet.</p>
          ) : (
            <LedgerTable
              label="Projects"
              columns={WINDOW_COLUMNS}
              rows={account.projects.map((project) => ({
                key: project.projectKey,
                name: project.projectLabel,
                cells: USAGE_WINDOWS.map(({ key }) => tokensText(windowTokens(project.usage, key)))
              }))}
            />
          )}
        </CardSection>

        <CardSection title="Limits" note={account.limits.length > 0 ? 'last read by Orca' : null}>
          <AccountLimits accountName={name} limits={account.limits} nowMs={nowMs} />
        </CardSection>
      </Plate>
    </article>
  )
}

interface CardSectionProps {
  title: string
  note?: string | null
  children: ReactNode
}

function CardSection({ title, note, children }: CardSectionProps) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-heading text-text-primary">{title}</h3>
        {note && <span className="text-caption text-text-tertiary">{note}</span>}
      </div>
      {children}
    </section>
  )
}
