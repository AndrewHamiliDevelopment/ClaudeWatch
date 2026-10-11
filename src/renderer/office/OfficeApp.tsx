import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useNow, useOfficeTheme } from './hooks'
import { buildAttentionQueue } from './logic/attention-queue'
import { mainAgentForSession, sessionForAgent, summariseFloors } from './logic/floor-model'
import { canRespond } from './logic/interactions'
import { buildNameCards } from './logic/name-cards'
import { INITIAL_OFFICE_STATE, officeReducer } from './logic/office-reducer'
import { buildCompanyList, buildOfficesTree } from './logic/zone-model'
import { createFrameMetrics } from './frame-metrics'
import { AgentActions } from './hud/AgentActions'
import { AttentionRail } from './hud/AttentionRail'
import { BottomBar } from './hud/BottomBar'
import { EmptyState } from './hud/EmptyState'
import { HealthBanner } from './hud/HealthBanner'
import { Inspector } from './hud/Inspector'
import { ListView } from './hud/ListView'
import { MetricsOverlay } from './hud/MetricsOverlay'
import { OfficesPanel } from './hud/OfficesPanel'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { OfficeFeed } from './scene-model'
import {
  useAttentionAnnouncement,
  useFeedSubscription,
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
  const { theme, cycleTheme } = useOfficeTheme()
  const nowMs = useNow(1000)
  const [speakingAgentKey, setSpeakingAgentKey] = useState<string | null>(null)

  const is3DAvailable = hasWebGL && !hasSceneFailed
  const isShowingList = state.isListView || !is3DAvailable
  useFeedSubscription(feed, dispatch)
  useOfficeHotkeys(dispatch, !is3DAvailable, cycleTheme)

  const frame = state.frame
  const queue = useMemo(() => buildAttentionQueue(frame?.sessions ?? []), [frame])
  const announcement = useAttentionAnnouncement(queue)
  // The Tower stays as a landmark showing the building's totals; it no longer picks floors.
  const towerFloors = useMemo(() => (frame ? summariseFloors(frame) : []), [frame])
  const companies = useMemo(() => (frame ? buildOfficesTree(frame) : []), [frame])
  const isConnecting = !frame || (!frame.connected && frame.sessions.length === 0)
  const focusedFloor = frame?.floors.find((floor) => floor.floorId === state.focusedFloorId)
  const selectedAgent = frame?.agents.find((agent) => agent.agentKey === state.selectedAgentKey)
  const selectedSession = frame && selectedAgent ? sessionForAgent(frame, selectedAgent) : undefined
  const reviewableKeys = useMemo(
    () => new Set((frame?.sessions ?? []).filter(canRespond).map((session) => session.key)),
    [frame]
  )

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
  const onSent = (sessionKey: string): void => {
    const speaker = frame ? mainAgentForSession(frame, sessionKey) : undefined
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
              agents={frame.agents.filter((agent) => agent.floorId === focusedFloor.floorId)}
              cards={buildNameCards(frame, focusedFloor.floorId, state.selectedAgentKey)}
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

      <div className="pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-3 p-3 md:grid-cols-[16rem_1fr_17rem] md:grid-rows-[1fr_auto]">
        <div className="pointer-events-auto flex min-h-0 flex-col gap-3 self-start">
          <AttentionRail
            queue={queue}
            activeSessionKey={selectedSession?.key ?? null}
            nowMs={nowMs}
            onOpen={(sessionKey) => dispatch({ type: 'session-opened', sessionKey })}
            onNext={() => dispatch({ type: 'next-attention' })}
            reviewableKeys={reviewableKeys}
            onReview={openReview}
          />
          {frame && <HealthBanner sources={frame.sources} />}
          {!is3DAvailable && (
            <p className="rounded-card border border-border bg-surface-raised px-3 py-2 text-body text-text-secondary">
              The 3D view is unavailable on this device, so the office is shown as a list.
            </p>
          )}
        </div>

        <div className="flex min-h-0 items-center justify-center md:row-span-1">
          {isConnecting || (frame && frame.sessions.length === 0) ? (
            <div className="pointer-events-auto">
              <EmptyState isConnecting={isConnecting} />
            </div>
          ) : (
            isShowingList &&
            frame && (
              <div className="pointer-events-auto h-full w-full">
                <ListView
                  companies={buildCompanyList(frame)}
                  selectedAgentKey={state.selectedAgentKey}
                  onSelectAgent={selectAgent}
                />
              </div>
            )
          )}
        </div>

        <div className="pointer-events-auto flex max-h-full min-h-0 flex-col gap-3 self-start overflow-y-auto">
          <OfficesPanel
            companies={companies}
            focusedZoneId={state.focusedZoneId}
            onFlyToZone={flyToZone}
            onStart={(projectKey, provider) => feed.start(projectKey, provider)}
          />
          {selectedAgent && (
            <Inspector
              agent={selectedAgent}
              session={selectedSession}
              nowMs={nowMs}
              canFly={!isShowingList}
              onJump={(sessionKey) => feed.jump(sessionKey)}
              onFly={() => dispatch({ type: 'fly-to-selected' })}
              onClose={() => selectAgent(null)}
            >
              {selectedSession && (
                <AgentActions
                  key={selectedSession.key}
                  session={selectedSession}
                  feed={feed}
                  isReviewing={state.reviewingSessionKey === selectedSession.key}
                  onReviewClose={closeReview}
                  onSent={onSent}
                />
              )}
            </Inspector>
          )}
        </div>

        <div className="pointer-events-auto justify-self-center md:col-span-3">
          <BottomBar
            themeLabel={theme.label}
            onCycleTheme={cycleTheme}
            wallsMode={state.wallsMode}
            isListView={state.isListView}
            is3DAvailable={is3DAvailable}
            isMetricsVisible={state.isMetricsVisible}
            onWallsMode={(mode) => dispatch({ type: 'walls-set', mode })}
            onToggleList={() => dispatch({ type: 'list-toggled' })}
            onToggleMetrics={() => dispatch({ type: 'metrics-toggled' })}
          />
        </div>
      </div>

      {state.isMetricsVisible && !isShowingList && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          <MetricsOverlay metrics={metrics} />
        </div>
      )}
      <div role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </main>
  )
}
