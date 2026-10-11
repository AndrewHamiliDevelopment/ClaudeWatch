import type { InteractionFailure, SessionRef } from '../../../shared/office/types'
import {
  canPeek,
  canRespond,
  canTalk,
  failureMessage,
  type ReachTarget
} from '../logic/interactions'
import type { OfficeFeed } from '../scene-model'
import { PeekPanel } from './PeekPanel'
import { PermissionPanel } from './PermissionPanel'
import { TalkBox } from './TalkBox'
import { WorkOrderNote } from './WorkOrderNote'

interface AgentActionsProps {
  session: SessionRef
  // The session itself, or the teammate selected within it.
  target: ReachTarget
  feed: OfficeFeed
  isReviewing: boolean
  onReview: () => void
  onReviewClose: () => void
  onFocusTerminal: () => void
  onSent: (agentKey: string) => void
}

// The work order, talk, review and peek for the inspected agent, each shown only when it applies.
export function AgentActions({
  session,
  target,
  feed,
  isReviewing,
  onReview,
  onReviewClose,
  onFocusTerminal,
  onSent
}: AgentActionsProps) {
  const isOwnSession = target.key === session.key
  // Mounted while reviewing even after the prompt clears, so the panel itself closes the review.
  const isReviewOpen =
    isOwnSession && isReviewing && canRespond({ ...session, attention: 'permission' })
  const { attention } = session
  const waitingOn = attention === 'permission' || attention === 'question' ? attention : null
  // A typed message would answer the agent's open dialog (Enter confirms its default), so no box.
  const talkBlocker = ((): InteractionFailure | null => {
    if (isOwnSession && waitingOn) return 'prompt-on-screen'
    return canTalk(target) ? null : 'not-in-orca'
  })()
  return (
    <div className="flex flex-col gap-3">
      {isReviewOpen && (
        <PermissionPanel
          session={session}
          peek={feed.peek}
          respond={feed.respond}
          onClose={onReviewClose}
        />
      )}
      {isOwnSession && waitingOn && !isReviewOpen && (
        <WorkOrderNote
          attention={waitingOn}
          sessionName={session.name}
          sinceMs={session.updatedAtMs}
          onAction={canRespond(session) ? onReview : onFocusTerminal}
        />
      )}
      {talkBlocker ? (
        <p className="text-xs text-text-secondary">{failureMessage(talkBlocker)}</p>
      ) : (
        <TalkBox agentKey={target.key} agentName={target.name} send={feed.send} onSent={onSent} />
      )}
      {canPeek(target) && <PeekPanel agentKey={target.key} peek={feed.peek} />}
    </div>
  )
}
