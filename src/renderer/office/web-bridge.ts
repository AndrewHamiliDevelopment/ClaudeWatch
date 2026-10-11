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
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const FEED_RETRY_MS = 1000

// Listing every reason keeps this in step with the contract: a new one fails to compile here.
const FAILURES: Record<InteractionFailure, true> = {
  'unknown-session': true,
  'not-in-orca': true,
  'orca-unavailable': true,
  'terminal-not-found': true,
  'no-permission-prompt': true,
  'prompt-on-screen': true,
  'prompt-changed': true,
  'unsupported-provider': true,
  'invalid-input': true,
  'not-permitted': true
}
const FOCUS_TARGETS = ['pane', 'app', 'terminal', 'terminal-app'] as const

// What this page can show the standalone server: the one-time code in its launch address,
// taken out of the address at once, or the session token this tab stored after trading one.
// Null when the page was not launched by the server.
export function takeLaunchToken(
  page: Pick<Window, 'location' | 'history' | 'sessionStorage'>
): string | null {
  const launchCode = TOKEN_FRAGMENT.exec(page.location.hash)?.[1]
  if (!launchCode) return page.sessionStorage.getItem(TOKEN_KEY)
  page.history.replaceState(null, '', page.location.pathname + page.location.search)
  return launchCode
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
    // One signal serves every retry, so each wait takes its listener away again.
    const finish = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish)
  })
}

// Trades the launch code for the session token and stores it for a reload of this tab.
// Null when the server refuses: the code works once, so there is nothing to retry.
async function openSession(launchCode: string): Promise<string | null> {
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${launchCode}` }
    })
    const token = field(await response.json(), 'token')
    if (typeof token !== 'string' || !SESSION_TOKEN.test(token)) return null
    window.sessionStorage.setItem(TOKEN_KEY, token)
    return token
  } catch {
    return null
  }
}

// The preload's bridge, for a page served by the standalone Office server: the feed is one
// long response read line by line, and every call carries the session token in a header.
// `credential` is what takeLaunchToken found: this tab's stored token, or a launch code.
export function createWebBridge(credential: string): OfficeBridgeApi {
  let sessionToken = window.sessionStorage.getItem(TOKEN_KEY) === credential ? credential : null
  const opening = sessionToken
    ? null
    : openSession(credential).then((token) => {
        sessionToken = token
      })
  // Null when no session could be opened: then nothing is sent.
  const authorization = async (): Promise<{ Authorization: string } | null> => {
    if (opening) await opening
    return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : null
  }
  const listeners = new Set<(message: FeedMessage) => void>()
  let feed: AbortController | null = null

  const deliver = (message: FeedMessage): void => {
    for (const listener of listeners) listener(message)
  }

  // Resolves when the stream ends: true when reconnecting could help.
  async function readFeed(signal: AbortSignal): Promise<boolean> {
    const headers = await authorization()
    // The token is per launch: without one, or once it is refused, no retry can succeed.
    if (!headers) return false
    const response = await fetch('/api/feed', { headers, signal })
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
      const headers = await authorization()
      if (!headers) return null
      const response = await fetch(path, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
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
    send: async (sessionKey, text) => toResult(await post('/api/send', { sessionKey, text })),
    respond: async (sessionKey, decision, fingerprint) =>
      toResult(await post('/api/respond', { sessionKey, decision, fingerprint })),
    peek: async (sessionKey) => toPeekResult(await post('/api/peek', { sessionKey })),
    start: async (projectKey, provider) =>
      toResult(await post('/api/start', { projectKey, provider }))
  }
}
