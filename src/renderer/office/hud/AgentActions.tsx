import type { SessionRef } from '../../../shared/office/types'
import { canPeek, canRespond, canTalk, failureMessage } from '../logic/interactions'
import type { OfficeFeed } from '../scene-model'
import { PeekPanel } from './PeekPanel'
import { PermissionPanel } from './PermissionPanel'
import { TalkBox } from './TalkBox'

interface AgentActionsProps {
  session: SessionRef
  feed: OfficeFeed
  isReviewing: boolean
  onReviewClose: () => void
  onSent: (sessionKey: string) => void
}

// Talk, review and peek for the inspected agent, each shown only when the session can be reached.
export function AgentActions({
  session,
  feed,
  isReviewing,
  onReviewClose,
  onSent
}: AgentActionsProps) {
  if (!canTalk(session)) {
    return <p className="text-caption text-text-secondary">{failureMessage('not-in-orca')}</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {/* Mounted while reviewing even after the prompt clears, so the panel itself closes the review. */}
      {isReviewing && canRespond({ ...session, attention: 'permission' }) && (
        <PermissionPanel
          session={session}
          peek={feed.peek}
          respond={feed.respond}
          onClose={onReviewClose}
        />
      )}
      <TalkBox
        sessionKey={session.key}
        sessionName={session.name}
        send={feed.send}
        onSent={onSent}
      />
      {canPeek(session) && <PeekPanel sessionKey={session.key} peek={feed.peek} />}
    </div>
  )
}
