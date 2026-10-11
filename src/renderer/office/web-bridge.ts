import type {
  FeedMessage,
  FocusResult,
  InteractionFailure,
  InteractionResult,
  PeekResult
} from '../../shared/office/types'
import { isFeedMessage } from '../../shared/office/feed-message'

// The preload's own type, read off the global it fills, so the two cannot drift apart.
type OfficeBridgeApi = NonNullable<Window['officeBridge']>

const TOKEN_KEY = 'claudewatch.office.token'
const TOKEN_FRAGMENT = /^#t=([A-Za-z0-9_-]{43})$/
const FEED_RETRY_MS = 1000

// Listing every reason keeps this in step with the contract: a new one fails to compile here.
const FAILURES: Record<InteractionFailure, true> = {
  'unknown-session': true,
  'not-in-orca': true,
  'orca-unavailable': true,
  'terminal-not-found': true,
  'no-permission-prompt': true,
  'prompt-changed': true,
  'unsupported-provider': true,
  'invalid-input': true,
  'not-permitted': true
}
const FOCUS_TARGETS = ['pane', 'app', 'terminal'] as const

// The token the standalone server put in the launch address, or null when the page was not
// launched by it. It moves to this tab's storage so a reload keeps it and the address loses it.
export function takeLaunchToken(
  page: Pick<Window, 'location' | 'history' | 'sessionStorage'>
): string | null {
  const launched = TOKEN_FRAGMENT.exec(page.location.hash)?.[1]
  if (!launched) return page.sessionStorage.getItem(TOKEN_KEY)
  page.sessionStorage.setItem(TOKEN_KEY, launched)
  page.history.replaceState(null, '', page.location.pathname + page.location.search)
  return launched
}

function parseFeedLine(line: string): FeedMessage | null {
  try {
    const message: unknown = JSON.parse(line)
    return isFeedMessage(message) ? message : null
  } catch {
    return null
  }
}

const field = (reply: unknown, name: string): unknown =>
  typeof reply === 'object' && reply !== null ? Reflect.get(reply, name) : undefined
const isFailure = (value: unknown): value is InteractionFailure =>
  typeof value === 'string' && Object.hasOwn(FAILURES, value)

// A reason this page does not know is dropped, so the Office shows its general failure
// wording instead of nothing.
function toResult(reply: unknown): InteractionResult {
  if (field(reply, 'success') === true) return { success: true }
  const reason = field(reply, 'reason')
  return isFailure(reason) ? { success: false, reason } : { success: false }
}

function toFocusResult(reply: unknown): FocusResult {
  const result = toResult(reply)
  const target = FOCUS_TARGETS.find((known) => known === field(reply, 'target'))
  return target ? { ...result, target } : result
}

function toPeekResult(reply: unknown): PeekResult {
  const lines = field(reply, 'lines')
  const fingerprint = field(reply, 'fingerprint')
  return {
    ...toResult(reply),
    lines: Array.isArray(lines) ? lines.filter((line) => typeof line === 'string') : [],
    ...(typeof fingerprint === 'string' ? { fingerprint } : {})
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

// The preload's bridge, for a page served by the standalone Office server: the feed is one
// long response read line by line, and every call carries the launch token in a header.
export function createWebBridge(token: string): OfficeBridgeApi {
  const authorization = { Authorization: `Bearer ${token}` }
  const listeners = new Set<(message: FeedMessage) => void>()
  let feed: AbortController | null = null

  const deliver = (message: FeedMessage): void => {
    for (const listener of listeners) listener(message)
  }

  // Resolves when the stream ends: true when reconnecting could help.
  async function readFeed(signal: AbortSignal): Promise<boolean> {
    const response = await fetch('/api/feed', { headers: authorization, signal })
    // The token is per launch: once it is refused, no retry from this page can succeed.
    if (response.status === 401 || response.status === 403) return false
    const reader = response.ok ? response.body?.getReader() : undefined
    if (!reader) return true
    const decoder = new TextDecoder()
    let unfinished = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return true
      const lines = (unfinished + decoder.decode(value, { stream: true })).split('\n')
      unfinished = lines.pop() ?? ''
      for (const line of lines) {
        const message = parseFeedLine(line)
        if (message) deliver(message)
      }
    }
  }

  async function followFeed(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const canRetry = await readFeed(signal).catch(() => true)
      if (signal.aborted) return
      // What the Office shows may be out of date until the next hello.
      deliver({ type: 'resync' })
      if (!canRetry) return
      await pause(FEED_RETRY_MS, signal)
    }
  }

  async function post(path: string, body: object): Promise<unknown> {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      return await response.json()
    } catch {
      return null
    }
  }
  const focus = async (agentKey: string): Promise<FocusResult> =>
    toFocusResult(await post('/api/focus', { agentKey }))

  return {
    ready: async () => {
      if (feed) return
      feed = new AbortController()
      void followFeed(feed.signal)
    },
    onFeedMessage: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        feed?.abort()
        feed = null
      }
    },
    focus,
    jump: focus,
    send: async (sessionKey, text) => toResult(await post('/api/send', { sessionKey, text })),
    respond: async (sessionKey, decision, fingerprint) =>
      toResult(await post('/api/respond', { sessionKey, decision, fingerprint })),
    peek: async (sessionKey) => toPeekResult(await post('/api/peek', { sessionKey })),
    start: async (projectKey, provider) =>
      toResult(await post('/api/start', { projectKey, provider }))
  }
}
