import { World } from '../../office/sim/world'
import type { LayoutMap } from '../../office/sim/layout'
import { isJsonObject } from '../../shared/json-object'
import { applyFeed } from '../../shared/office/apply-feed'
import type {
  FocusResult,
  FeedMessage,
  InteractionResult,
  OfficeSnapshot,
  PeekResult,
  PermissionDecision,
  ProviderId
} from '../../shared/office/types'
import { officeSettings, type OfficeSettingsStore } from '../office/logic/office-settings'
import type { FloorGeometry, OfficeFeed, OfficeFrame } from '../office/scene-model'
import { toFloorGeometry } from './layout-geometry'

export interface FeedSource {
  ready(): Promise<void>
  onFeedMessage(listener: (message: FeedMessage) => void): () => void
  focus(agentKey: string): Promise<FocusResult>
  send(sessionKey: string, text: string): Promise<InteractionResult>
  respond(
    sessionKey: string,
    decision: PermissionDecision,
    fingerprint: string
  ): Promise<InteractionResult>
  peek(sessionKey: string): Promise<PeekResult>
  start(projectKey: string, provider: ProviderId): Promise<InteractionResult>
}

interface LayoutStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LAYOUT_KEY = 'claudewatch.office.layout'
const TICK_MS = 100

const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isJsonObject)

// Only the outline the sim reads order and bays through is checked; the sim never trusts more.
function isLayoutMap(value: unknown): value is LayoutMap {
  if (!isJsonObject(value) || value.version !== 1 || !isJsonObject(value.reservations)) return false
  const { floors } = value
  return (
    isObjectArray(floors) &&
    floors.every(
      (floor) =>
        isObjectArray(floor.rooms) &&
        isObjectArray(floor.zones) &&
        floor.zones.every((zone) => isObjectArray(zone.children))
    )
  )
}

// Storage is null, or throws, where site data is blocked, and anything else in it is not a
// layout: the office then starts from a fresh one.
function loadLayout(storage: LayoutStorage | null): LayoutMap | undefined {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(LAYOUT_KEY) ?? 'null')
    return isLayoutMap(saved) ? saved : undefined
  } catch {
    return undefined
  }
}

function saveLayout(storage: LayoutStorage | null, serialised: string): void {
  try {
    storage?.setItem(LAYOUT_KEY, serialised)
  } catch {
    // Not remembered; the feed listener that called this must keep running.
  }
}

// Runs the office sim in the renderer on top of the bridge feed and emits a frame when it changes.
export function createLiveFeed(
  source: FeedSource,
  options: {
    storage: LayoutStorage | null
    now?: () => number
    // The owner's switches; the sim reads only the lounge trips.
    settings?: Pick<OfficeSettingsStore, 'get' | 'subscribe'>
  }
): OfficeFeed {
  const now = options.now ?? Date.now
  const settings = options.settings ?? officeSettings
  const listeners = new Set<(frame: OfficeFrame) => void>()
  let stop: (() => void) | null = null

  const start = (): (() => void) => {
    const world = new World({
      saved: loadLayout(options.storage),
      loungeTrips: settings.get().loungeTrips
    })
    // A running office follows the switch: the next step walks agents back, or lets them go.
    const offSettings = settings.subscribe(() => world.setLoungeTrips(settings.get().loungeTrips))
    let snapshot: OfficeSnapshot | null = null
    let floors: FloorGeometry[] = []
    let floorsKey = ''
    let lastTick = now()
    let savedLayout = ''
    let lastAgents = ''
    let isDirty = true

    const offFeed = source.onFeedMessage((message) => {
      snapshot = applyFeed(snapshot, message)
      world.apply(message)
      const layout = world.layout()
      // Most messages change no geometry: the scene keeps its world while the floors are the same.
      const nextFloors = toFloorGeometry(layout, snapshot?.sessions ?? [])
      const nextFloorsKey = JSON.stringify(nextFloors)
      if (nextFloorsKey !== floorsKey) {
        floors = nextFloors
        floorsKey = nextFloorsKey
      }
      isDirty = true
      const serialised = JSON.stringify(layout)
      if (serialised !== savedLayout) {
        saveLayout(options.storage, serialised)
        savedLayout = serialised
      }
    })
    void source.ready()

    const timer = setInterval(() => {
      const tick = now()
      const agents = world.step(tick - lastTick)
      lastTick = tick
      // Idle offices produce identical frames; skip them so the scene is not re-rendered for nothing.
      const agentsKey = JSON.stringify(agents)
      if (!isDirty && agentsKey === lastAgents) return
      isDirty = false
      lastAgents = agentsKey
      const frame: OfficeFrame = {
        floors,
        agents,
        sessions: snapshot?.sessions ?? [],
        connected: snapshot !== null,
        sources: snapshot?.sources ?? [],
        accounts: snapshot?.accounts
      }
      for (const listener of listeners) listener(frame)
    }, TICK_MS)

    return () => {
      clearInterval(timer)
      offFeed()
      offSettings()
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (!stop) stop = start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && stop) {
          stop()
          stop = null
        }
      }
    },
    focus: (agentKey) => source.focus(agentKey),
    send: (sessionKey, text) => source.send(sessionKey, text),
    respond: (sessionKey, decision, fingerprint) =>
      source.respond(sessionKey, decision, fingerprint),
    peek: (sessionKey) => source.peek(sessionKey),
    start: (projectKey, provider) => source.start(projectKey, provider)
  }
}
