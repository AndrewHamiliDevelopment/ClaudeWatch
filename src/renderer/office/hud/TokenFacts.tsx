import type { SessionRef, SubagentRef } from '../../../shared/office/types'
import { SegmentedMeter } from '../../components/deck/SegmentedMeter'
import { formatTokens, sessionTokens } from '../../deck/tokens'
import { Fact } from './Fact'
import { contextShare, contextText, memberTokens, tokensText, usageParts } from './tokens'

const PART_LABELS = [
  ['input', 'Input'],
  ['output', 'Output'],
  ['cacheWrite', 'Cache write'],
  ['cacheRead', 'Cache read']
] as const

function activeAndSpawned(session: SessionRef): string {
  const active = `${session.subagents.length} active`
  return session.usage ? `${active}, ${session.usage.spawned} spawned` : active
}

// What a subagent or teammate spent on its own.
export function MemberTokenFacts({ member }: { member: SubagentRef }) {
  return <Fact term="Tokens" value={tokensText(memberTokens(member))} isLantern />
}

// A lead's spend: the total, its four parts, the context window, and the agents it started.
export function SessionTokenFacts({ session }: { session: SessionRef }) {
  const { usage } = session
  const parts = usage ? usageParts(usage) : null
  const context = usage ? contextText(usage) : null
  const share = usage ? contextShare(usage) : null
  return (
    <>
      <Fact term="Tokens" value={tokensText(sessionTokens(usage))} isLantern />
      {parts &&
        PART_LABELS.map(([part, label]) => (
          <Fact key={part} term={label} value={formatTokens(parts[part])} isNested />
        ))}
      {context && (
        <Fact term="Context" value={context}>
          {share !== null && (
            <SegmentedMeter
              label="Context window"
              percent={share}
              valueText={context}
              className="mt-1"
            />
          )}
        </Fact>
      )}
      <Fact term="Subagents" value={activeAndSpawned(session)} />
    </>
  )
}
