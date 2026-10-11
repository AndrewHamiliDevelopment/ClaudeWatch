import { World } from '../../office/sim/world'
import type { LayoutMap } from '../../office/sim/layout'
import { applyFeed } from '../../shared/office/apply-feed'
import type {
  FeedMessage,
  InteractionResult,
  OfficeSnapshot,
  PeekResult,
  PermissionDecision,
  ProviderId
} from '../../shared/office/types'
import type { FloorGeometry, OfficeFeed, OfficeFrame } from '../office/scene-model'
import { toFloorGeometry, toSceneAgent } from './layout-geometry'

export interface FeedSource {
  ready(): Promise<void>
  onFeedMessage(listener: (message: FeedMessage) => void): () => void
  jump(sessionKey: string): Promise<{ success: boolean }>
  send(sessionKey: string, text: string): Promise<InteractionResult>
  respond(sessionKey: string, decision: PermissionDecision): Promise<InteractionResult>
  peek(sessionKey: string): Promise<PeekResult>
  start(projectKey: string, provider: ProviderId): Promise<InteractionResult>
}

interface LayoutStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LAYOUT_KEY = 'claudewatch.office.layout'
const TICK_MS = 100

function loadLayout(storage: LayoutStorage): LayoutMap | undefined {
  try {
    const saved = JSON.parse(storage.getItem(LAYOUT_KEY) ?? 'null')
    return saved?.version === 1 ? saved : undefined
  } catch {
    return undefined
  }
}

// Runs the office sim in the renderer on top of the bridge feed and emits a frame per tick.
export function createLiveFeed(
  source: FeedSource,
  options: { storage: LayoutStorage; now?: () => number }
): OfficeFeed {
  const now = options.now ?? Date.now
  const listeners = new Set<(frame: OfficeFrame) => void>()
  let stop: (() => void) | null = null

  const start = (): (() => void) => {
    const world = new World({ now, saved: loadLayout(options.storage) })
    let snapshot: OfficeSnapshot | null = null
    let floors: FloorGeometry[] = []
    let lastTick = now()

    const offFeed = source.onFeedMessage((message) => {
      snapshot = applyFeed(snapshot, message)
      world.apply(message)
      const layout = world.layout()
      floors = toFloorGeometry(layout, snapshot?.sessions ?? [])
      options.storage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    })
    void source.ready()

    const timer = setInterval(() => {
      const tick = now()
      const agents = world.step(tick - lastTick).map(toSceneAgent)
      lastTick = tick
      const frame: OfficeFrame = { floors, agents, sessions: snapshot?.sessions ?? [] }
      for (const listener of listeners) listener(frame)
    }, TICK_MS)

    return () => {
      clearInterval(timer)
      offFeed()
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
    jump(sessionKey) {
      void source.jump(sessionKey)
    },
    send: (sessionKey, text) => source.send(sessionKey, text),
    respond: (sessionKey, decision) => source.respond(sessionKey, decision),
    peek: (sessionKey) => source.peek(sessionKey),
    start: (projectKey, provider) => source.start(projectKey, provider)
  }
}
