import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Plate } from '../components/deck/Plate'
import { useNow, useOfficeTheme } from './hooks'
import { buildAttentionQueue } from './logic/attention-queue'
import {
  bayForAgent,
  mainAgentForSession,
  memberForAgent,
  sessionForAgent,
  summariseFloors
} from './logic/floor-model'
import { canRespond, reachTarget } from './logic/interactions'
import { buildNameCards, buildProjectStacks } from './logic/name-cards'
import { INITIAL_OFFICE_STATE, officeReducer } from './logic/office-reducer'
import { resolveTheme, useThemeAssignments } from './logic/office-themes'
import { buildCompanyList, buildOfficesTree, findZone } from './logic/zone-model'
import { createFrameMetrics } from './frame-metrics'
import { AgentActions } from './hud/AgentActions'
import { buildAgentFacts, type AgentFacts } from './hud/agent-facts'
import { AttentionRail } from './hud/AttentionRail'
import { BottomBar } from './hud/BottomBar'
import { EmptyState } from './hud/EmptyState'
import { FocusNotice } from './hud/FocusNotice'
import { HealthBanner } from './hud/HealthBanner'
import { Inspector } from './hud/Inspector'
import { ListView } from './hud/ListView'
import { MetricsOverlay } from './hud/MetricsOverlay'
import { OfficesPanel } from './hud/OfficesPanel'
import { ResourceBar } from './hud/ResourceBar'
import { characterFor } from './hud/theme-character'
import { buildTokenLedger } from './hud/tokens'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { OfficeFeed } from './scene-model'
import {
  useAttentionAnnouncement,
  useFeedSubscription,
  useFocusTerminal,
  useOfficeHotkeys
} from './use-office-effects'
import { canCreateWebGL2 } from './webgl-support'

// The scene component loads separately so the HUD can paint before Canvas mounts.
const OfficeScene = lazy(() => import('./scene/OfficeScene'))
const SPEECH_BUBBLE_MS = 1500

export function OfficeApp({ feed }: { feed: OfficeFeed }) {
  const [state, dispatch] = useReducer(officeReducer, INITIAL_OFFICE_STATE)
  const [hasWebGL] = useState(canCreateWebGL2)
  const [hasSceneFailed, setHasSceneFailed] = useState(false)
  const [metrics] = useState(createFrameMetrics)
  const nowMs = useNow(1000)
  const [speakingAgentKey, setSpeakingAgentKey] = useState<string | null>(null)
  const { notice, focusTerminal, dismissNotice } = useFocusTerminal(feed)

  const is3DAvailable = hasWebGL && !hasSceneFailed
  const isShowingList = state.isListView || !is3DAvailable
  useFeedSubscription(feed, dispatch)

  const frame = state.frame
  const focusedZone = useMemo(() => {
    const zoneId = state.focusedZoneId
    if (!frame || !zoneId) return undefined
    return frame.floors.flatMap((floor) => findZone(floor, zoneId) ?? [])[0]
  }, [frame, state.focusedZoneId])
  const { theme, cycleTheme, cycled } = useOfficeTheme(focusedZone)
  const themeAssignments = useThemeAssignments()

  const queue = useMemo(() => buildAttentionQueue(frame?.sessions ?? []), [frame])
  const announcement = useAttentionAnnouncement(queue)
  // The Tower stays as a landmark showing the building's totals; it no longer picks floors.
  const towerFloors = useMemo(() => (frame ? summariseFloors(frame) : []), [frame])
  const companies = useMemo(() => (frame ? buildOfficesTree(frame) : []), [frame])
  const ledger = useMemo(() => buildTokenLedger(frame?.sessions ?? []), [frame])
  const agentFacts = useMemo(
    () => (frame ? buildAgentFacts(frame) : new Map<string, AgentFacts>()),
    [frame]
  )
  // Memoised on the frame: the 1 Hz clock re-renders the HUD and must not rebuild scene inputs.
  const floorId = state.focusedFloorId
  const floorAgents = useMemo(
    () => (frame ? frame.agents.filter((agent) => agent.floorId === floorId) : []),
    [frame, floorId]
  )
  const cards = useMemo(
    () => (frame && floorId ? buildNameCards(frame, floorId, state.selectedAgentKey) : []),
    [frame, floorId, state.selectedAgentKey]
  )
  const stacks = useMemo(
    () => (frame && floorId ? buildProjectStacks(frame, floorId) : []),
    [frame, floorId]
  )
  const companyList = useMemo(() => (frame ? buildCompanyList(frame) : []), [frame])
  const isConnecting = !frame || (!frame.connected && frame.sessions.length === 0)
  const focusedFloor = frame?.floors.find((floor) => floor.floorId === state.focusedFloorId)
  const selectedAgent = frame?.agents.find((agent) => agent.agentKey === state.selectedAgentKey)
  const selectedSession = frame && selectedAgent ? sessionForAgent(frame, selectedAgent) : undefined
  const selectedMember = selectedAgent
    ? memberForAgent(selectedSession, selectedAgent.agentKey)
    : undefined
  const selectedTarget = selectedSession ? reachTarget(selectedSession, selectedMember) : undefined
  const selectedTargetKey = selectedTarget?.key
  const selectedCharacter =
    frame && selectedAgent && selectedSession
      ? characterFor(
          resolveTheme(selectedSession, themeAssignments, theme.id),
          selectedAgent,
          bayForAgent(frame, selectedAgent)
        )
      : null
  const reviewableKeys = useMemo(
    () => new Set((frame?.sessions ?? []).filter(canRespond).map((session) => session.key)),
    [frame]
  )

  const focusSelected = useCallback(() => {
    if (selectedTargetKey) focusTerminal(selectedTargetKey)
  }, [selectedTargetKey, focusTerminal])
  useOfficeHotkeys(dispatch, !is3DAvailable, {
    onCycleTheme: cycleTheme,
    onFocusTerminal: focusSelected
  })

  useEffect(() => {
    if (!speakingAgentKey) return
    const timer = setTimeout(() => setSpeakingAgentKey(null), SPEECH_BUBBLE_MS)
    return () => clearTimeout(timer)
  }, [speakingAgentKey])

  const selectAgent = useCallback(
    (agentKey: string | null) => dispatch({ type: 'agent-selected', agentKey }),
    []
  )
  const flyToAgent = useCallback(
    (agentKey: string) => dispatch({ type: 'agent-flown', agentKey }),
    []
  )
  const onSceneError = useCallback(() => setHasSceneFailed(true), [])
  const flyToZone = useCallback((zoneId: string) => dispatch({ type: 'zone-flown', zoneId }), [])
  const openReview = useCallback(
    (sessionKey: string) => dispatch({ type: 'review-opened', sessionKey }),
    []
  )
  const closeReview = useCallback(() => dispatch({ type: 'review-closed' }), [])
  // A teammate speaks for itself; a message to a session shows on its lead.
  const onSent = (agentKey: string): void => {
    const speaker =
      frame?.agents.find((agent) => agent.isSubagent && agent.agentKey === agentKey) ??
      (frame ? mainAgentForSession(frame, agentKey) : undefined)
    if (speaker) setSpeakingAgentKey(speaker.agentKey)
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-surface text-text-primary">
      <h1 className="sr-only">Office</h1>
      {!isShowingList && focusedFloor && frame && (
        <SceneErrorBoundary onError={onSceneError}>
          <Suspense fallback={null}>
            <OfficeScene
              theme={theme}
              floors={towerFloors}
              sessions={frame.sessions}
              onFlyToZone={flyToZone}
              floor={focusedFloor}
              agents={floorAgents}
              cards={cards}
              stacks={stacks}
              selectedAgentKey={state.selectedAgentKey}
              wallsMode={state.wallsMode}
              cameraRequest={state.cameraRequest}
              metrics={metrics}
              onSelectAgent={selectAgent}
              onFlyToAgent={flyToAgent}
              reviewableKeys={reviewableKeys}
              onReview={openReview}
              speakingAgentKey={speakingAgentKey}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}

      <div className="pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 p-3 md:grid-cols-[18.5rem_minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)_auto]">
        <div className="pointer-events-auto flex min-h-0 flex-col gap-3 self-start md:max-h-full md:overflow-y-auto">
          <OfficesPanel
            companies={companies}
            ledger={ledger}
            defaultTheme={theme}
            focusedZoneId={state.focusedZoneId}
            onFlyToZone={flyToZone}
            onStart={(projectKey, provider) => feed.start(projectKey, provider)}
          />
          <AttentionRail
            queue={queue}
            activeSessionKey={selectedSession?.key ?? null}
            onOpen={(sessionKey) => dispatch({ type: 'session-opened', sessionKey })}
            onNext={() => dispatch({ type: 'next-attention' })}
            reviewableKeys={reviewableKeys}
            onReview={openReview}
            onFocusTerminal={focusTerminal}
          />
          {frame && <HealthBanner sources={frame.sources} />}
          {!is3DAvailable && (
            <Plate faceClassName="px-3 py-2 text-xs text-text-secondary">
              <p>The 3D view is unavailable on this device, so the office is shown as a list.</p>
            </Plate>
          )}
        </div>

        <div className="flex min-h-0 flex-col items-center gap-3">
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <ResourceBar agentCount={frame?.agents.length ?? 0} tokens={ledger.office} />
            <FocusNotice message={notice} onDismiss={dismissNotice} />
            {state.isMetricsVisible && !isShowingList && <MetricsOverlay metrics={metrics} />}
          </div>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {isConnecting || (frame && frame.sessions.length === 0) ? (
              <div className="pointer-events-auto">
                <EmptyState isConnecting={isConnecting} />
              </div>
            ) : (
              isShowingList &&
              frame && (
                <div className="pointer-events-auto h-full w-full">
                  <ListView
                    companies={companyList}
                    agentFacts={agentFacts}
                    selectedAgentKey={state.selectedAgentKey}
                    onSelectAgent={selectAgent}
                    onFocusTerminal={focusTerminal}
                  />
                </div>
              )
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex max-h-full min-h-0 flex-col gap-3 self-start overflow-y-auto">
          {selectedAgent && (
            <Inspector
              agent={selectedAgent}
              session={selectedSession}
              member={selectedMember}
              character={selectedCharacter}
              nowMs={nowMs}
              canFly={!isShowingList}
              onFocusTerminal={focusSelected}
              onFly={() => dispatch({ type: 'fly-to-selected' })}
              onClose={() => selectAgent(null)}
            >
              {selectedSession && selectedTarget && (
                <AgentActions
                  key={selectedTarget.key}
                  session={selectedSession}
                  target={selectedTarget}
                  feed={feed}
                  isReviewing={state.reviewingSessionKey === selectedSession.key}
                  onReview={() => openReview(selectedSession.key)}
                  onReviewClose={closeReview}
                  onFocusTerminal={focusSelected}
                  onSent={onSent}
                />
              )}
            </Inspector>
          )}
        </div>

        <div className="pointer-events-auto justify-self-center md:col-span-3">
          <BottomBar
            themeScope={cycled.scope}
            themeLabel={cycled.theme.label}
            onCycleTheme={cycleTheme}
            wallsMode={state.wallsMode}
            isListView={state.isListView}
            is3DAvailable={is3DAvailable}
            isMetricsVisible={state.isMetricsVisible}
            onWallsMode={(mode) => dispatch({ type: 'walls-set', mode })}
            onToggleList={() => dispatch({ type: 'list-toggled' })}
            onToggleMetrics={() => dispatch({ type: 'metrics-toggled' })}
            onRotate={(direction) => dispatch({ type: 'camera-rotated', direction })}
            onZoom={(direction) => dispatch({ type: 'camera-zoomed', direction })}
            onFit={() => dispatch({ type: 'camera-fit' })}
          />
        </div>
      </div>

      <div role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </main>
  )
}
