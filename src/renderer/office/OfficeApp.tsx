import { lazy, Suspense, useCallback, useMemo, useReducer, useState } from 'react'
import { useNow } from './hooks'
import { buildAttentionQueue } from './logic/attention-queue'
import { buildListTree, sessionForAgent, summariseFloors } from './logic/floor-model'
import { buildNameCards } from './logic/name-cards'
import { INITIAL_OFFICE_STATE, officeReducer } from './logic/office-reducer'
import { createFrameMetrics } from './frame-metrics'
import { AttentionRail } from './hud/AttentionRail'
import { BottomBar } from './hud/BottomBar'
import { ElevatorPanel } from './hud/ElevatorPanel'
import { EmptyState } from './hud/EmptyState'
import { Inspector } from './hud/Inspector'
import { ListView } from './hud/ListView'
import { MetricsOverlay } from './hud/MetricsOverlay'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { OfficeFeed } from './scene-model'
import {
  useAttentionAnnouncement,
  useFeedSubscription,
  useOfficeHotkeys
} from './use-office-effects'
import { canCreateWebGL2 } from './webgl-support'

// three.js loads in its own chunk so the HUD paints before the scene is ready.
const OfficeScene = lazy(() => import('./scene/OfficeScene'))

export function OfficeApp({ feed }: { feed: OfficeFeed }) {
  const [state, dispatch] = useReducer(officeReducer, INITIAL_OFFICE_STATE)
  const [hasWebGL] = useState(canCreateWebGL2)
  const [hasSceneFailed, setHasSceneFailed] = useState(false)
  const [metrics] = useState(createFrameMetrics)
  const nowMs = useNow(1000)

  const is3DAvailable = hasWebGL && !hasSceneFailed
  const isShowingList = state.isListView || !is3DAvailable
  useFeedSubscription(feed, dispatch)
  useOfficeHotkeys(dispatch, !is3DAvailable)

  const frame = state.frame
  const queue = useMemo(() => buildAttentionQueue(frame?.sessions ?? []), [frame])
  const announcement = useAttentionAnnouncement(queue)
  const floors = useMemo(() => (frame ? summariseFloors(frame) : []), [frame])
  const focusedFloor = frame?.floors.find((floor) => floor.floorId === state.focusedFloorId)
  const selectedAgent = frame?.agents.find((agent) => agent.agentKey === state.selectedAgentKey)
  const selectedSession = frame && selectedAgent ? sessionForAgent(frame, selectedAgent) : undefined

  const selectAgent = useCallback(
    (agentKey: string | null) => dispatch({ type: 'agent-selected', agentKey }),
    []
  )
  const flyToAgent = useCallback(
    (agentKey: string) => dispatch({ type: 'agent-flown', agentKey }),
    []
  )
  const onSceneError = useCallback(() => setHasSceneFailed(true), [])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-surface text-text-primary">
      <h1 className="sr-only">Office</h1>
      {!isShowingList && focusedFloor && frame && (
        <SceneErrorBoundary onError={onSceneError}>
          <Suspense fallback={null}>
            <OfficeScene
              floor={focusedFloor}
              agents={frame.agents.filter((agent) => agent.floorId === focusedFloor.floorId)}
              cards={buildNameCards(frame, focusedFloor.floorId, state.selectedAgentKey)}
              selectedAgentKey={state.selectedAgentKey}
              wallsMode={state.wallsMode}
              cameraRequest={state.cameraRequest}
              metrics={metrics}
              onSelectAgent={selectAgent}
              onFlyToAgent={flyToAgent}
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
          />
          {!is3DAvailable && (
            <p className="rounded-card border border-border bg-surface-raised px-3 py-2 text-body text-text-secondary">
              The 3D view is unavailable on this device, so the office is shown as a list.
            </p>
          )}
        </div>

        <div className="flex min-h-0 items-center justify-center md:row-span-1">
          {frame && frame.agents.length === 0 ? (
            <div className="pointer-events-auto">
              <EmptyState />
            </div>
          ) : (
            isShowingList &&
            frame && (
              <div className="pointer-events-auto h-full w-full">
                <ListView
                  tree={buildListTree(frame)}
                  selectedAgentKey={state.selectedAgentKey}
                  onSelectAgent={selectAgent}
                />
              </div>
            )
          )}
        </div>

        <div className="pointer-events-auto flex min-h-0 flex-col gap-3 self-start">
          <ElevatorPanel
            floors={floors}
            focusedFloorId={state.focusedFloorId}
            onSelect={(floorId) => dispatch({ type: 'floor-selected', floorId })}
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
            />
          )}
        </div>

        <div className="pointer-events-auto justify-self-center md:col-span-3">
          <BottomBar
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
