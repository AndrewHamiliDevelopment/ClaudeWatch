import type { AgentView, SessionRef } from '../../../shared/office/types'
import { cn, formatElapsedTime } from '../../lib/utils'
import { gemFor } from '../logic/status-gem'
import { PROVIDER_LABEL } from '../office-palette'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS, PANEL_CLASS } from './hud-styles'
import { StateChip } from './StateChip'

interface InspectorProps {
  agent: AgentView
  session: SessionRef | undefined
  nowMs: number
  canFly: boolean
  onJump: (sessionKey: string) => void
  onFly: () => void
  onClose: () => void
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-caption text-text-secondary">{term}</dt>
      <dd className="min-w-0 truncate text-body tabular-nums text-text-primary">{value}</dd>
    </>
  )
}

export function Inspector({
  agent,
  session,
  nowMs,
  canFly,
  onJump,
  onFly,
  onClose
}: InspectorProps) {
  const gem = gemFor(agent)
  const elapsedSeconds = session ? Math.max(0, Math.floor((nowMs - session.startedAtMs) / 1000)) : 0
  return (
    <aside aria-label="Agent details" className={cn(PANEL_CLASS, 'flex flex-col gap-3 p-3')}>
      <div className="flex flex-col gap-1">
        <h2 className="truncate text-heading text-text-primary">{agent.label}</h2>
        {agent.isSubagent && session && (
          <p className="text-caption text-text-secondary">Subagent of {session.name}</p>
        )}
        {gem && <StateChip spec={gem} />}
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
        <Detail term="Project" value={session?.projectLabel ?? 'Unknown'} />
        <Detail term="Provider" value={PROVIDER_LABEL[agent.provider]} />
        <Detail term="Activity" value={agent.activity} />
        <Detail term="Tool" value={session?.currentTool?.name ?? 'None'} />
        <Detail term="Elapsed" value={formatElapsedTime(elapsedSeconds)} />
        <Detail term="Subagents" value={String(session?.subagents.length ?? 0)} />
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!session}
          onClick={() => session && onJump(session.key)}
          className={cn(
            HUD_BUTTON_CLASS,
            FOCUS_RING_CLASS,
            'bg-accent-hover font-medium text-white hover:bg-accent-hover/90'
          )}
        >
          Jump to terminal
        </button>
        {canFly && (
          <button type="button" onClick={onFly} className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS)}>
            Fly to
          </button>
        )}
        <button type="button" onClick={onClose} className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS)}>
          Close
        </button>
      </div>
    </aside>
  )
}
