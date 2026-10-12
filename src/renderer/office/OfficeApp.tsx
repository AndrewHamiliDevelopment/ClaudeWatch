import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Plate } from '../components/deck/Plate'
import { cn } from '../lib/utils'
import { useOfficeTheme } from './hooks'
import { mainAgentForSession } from './logic/floor-model'
import { canRespond } from './logic/interactions'
import { INITIAL_OFFICE_STATE, officeReducer } from './logic/office-reducer'
import { buildThemeRows, countThemeChoices, useThemeAssignments } from './logic/office-themes'
import { findZone } from './logic/zone-model'
import { createFrameMetrics } from './frame-metrics'
import { AgentActions } from './hud/AgentActions'
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
import { ThemesList } from './hud/ThemesList'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { OfficeFeed } from './scene-model'
import {
  useAttentionAnnouncement,
  useFeedSubscription,
  useFocusTerminal,
  useOfficeHotkeys
} from './use-office-effects'
import { selectionOf, useOfficeLists } from './use-office-model'
import { canCreateWebGL2 } from './webgl-support'

// The scene component loads separately so the HUD can paint before Canvas mounts.
const OfficeScene = lazy(() => import('./scene/OfficeScene'))
const SPEECH_BUBBLE_MS = 1500

interface OfficeAppProps {
  feed: OfficeFeed
  // The app's window draws no title bar, so the page supplies the strip it is dragged by.
  hasHiddenTitleBar?: boolean
}

export function OfficeApp({ feed, hasHiddenTitleBar = false }: OfficeAppProps) {
  const [state, dispatch] = useReducer(officeReducer, INITIAL_OFFICE_STATE)
  const [hasWebGL] = useState(canCreateWebGL2)
  const [hasSceneFailed, setHasSceneFailed] = useState(false)
  const [metrics] = useState(createFrameMetrics)
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
  const officeTheme = useOfficeTheme(focusedZone)
  const { theme, cycleTheme } = officeTheme
  const themeAssignments = useThemeAssignments()

  const floorId = state.focusedFloorId
  const lists = useOfficeLists(frame, floorId, state.selectedAgentKey)
  const { sessions, queue, towerFloors, companies, ledger, agentFacts } = lists
  const { floorAgents, cards, stacks, companyList } = lists
  const announcement = useAttentionAnnouncement(queue)
  const themeRows = useMemo(
    () => buildThemeRows(companies, themeAssignments, theme.id),
    [companies, themeAssignments, theme.id]
  )
  const isConnecting = !frame || (!frame.connected && frame.sessions.length === 0)
  const focusedFloor = frame?.floors.find((floor) => floor.floorId === floorId)
  const {
    agent: selectedAgent,
    session: selectedSession,
    member: selectedMember,
    target: selectedTarget,
    character: selectedCharacter
  } = selectionOf(frame, state.selectedAgentKey, themeAssignments, theme.id)
  const selectedTargetKey = selectedTarget?.key
  const isViewOnly = feed.isViewOnly === true
  const reviewableKeys = useMemo(
    () =>
      new Set(isViewOnly ? [] : (sessions ?? []).filter(canRespond).map((session) => session.key)),
    [sessions, isViewOnly]
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

      {hasHiddenTitleBar && (
        <div aria-hidden="true" className="drag-region absolute inset-x-0 top-0 h-9" />
      )}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 p-3 md:grid-cols-[18.5rem_minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)_auto]',
          // Panels start below the strip and the window's own buttons.
          hasHiddenTitleBar && 'pt-10'
        )}
      >
        <div className="pointer-events-auto flex min-h-0 flex-col gap-3 self-start md:max-h-full md:overflow-y-auto">
          <OfficesPanel
            companies={companies}
            ledger={ledger}
            themeRows={themeRows}
            onChooseTheme={officeTheme.chooseTheme}
            focusedZoneId={state.focusedZoneId}
            onFlyToZone={flyToZone}
            onStart={isViewOnly ? null : (projectKey, provider) => feed.start(projectKey, provider)}
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
            <ResourceBar
              agentCount={frame?.agents.length ?? 0}
              tokens={ledger.office}
              isPartial={ledger.isOfficePartial}
            />
            <FocusNotice message={notice} onDismiss={dismissNotice} />
            <FocusNotice message={officeTheme.notice} onDismiss={officeTheme.dismissNotice} />
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
              accounts={frame?.accounts}
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
            floorThemeLabel={theme.label}
            renderThemes={(id, close) => (
              <ThemesList
                id={id}
                companies={themeRows}
                floorTheme={theme}
                choiceCount={countThemeChoices(themeAssignments)}
                cycleScope={officeTheme.cycleScope}
                onChoose={officeTheme.chooseTheme}
                onClose={close}
              />
            )}
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
