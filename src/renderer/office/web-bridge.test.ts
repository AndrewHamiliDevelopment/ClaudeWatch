import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedMessage, OfficeSnapshot } from '../../shared/office/types'
import { createWebBridge, takeLaunchToken } from './web-bridge'

const TOKEN = 'k'.repeat(43)
const CODE = 'c'.repeat(43)
const TOKEN_KEY = 'claudewatch.office.token'
const snapshot: OfficeSnapshot = { rev: 3, generatedAtMs: 1, sessions: [], sources: [] }
const hello: FeedMessage = { type: 'hello', v: 1, snapshot }
const patch: FeedMessage = { type: 'patch', v: 1, seq: 4, upserts: [], removed: [] }

// A feed response the test writes to, and ends, by hand.
function feedResponse(): { response: Response; write: (text: string) => void; end: () => void } {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({ start: (started) => void (controller = started) })
  return {
    response: new Response(body),
    write: (text) => controller?.enqueue(encoder.encode(text)),
    end: () => controller?.close()
  }
}

const jsonReply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status })

describe('takeLaunchToken', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('takes the launch code out of the address and keeps it nowhere', () => {
    window.history.replaceState(null, '', `/office.html#t=${CODE}`)

    expect(takeLaunchToken(window)).toBe(CODE)
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/office.html')
    // The code works once, so a stored copy could only ever be refused.
    expect(window.sessionStorage.length).toBe(0)
  })

  it('finds this tab’s session token after a reload', () => {
    window.sessionStorage.setItem(TOKEN_KEY, TOKEN)

    expect(takeLaunchToken(window)).toBe(TOKEN)
  })

  it.each(['', '#t=short', `#t=${TOKEN}&x=1`, `#token=${TOKEN}`])(
    'finds none in a page opened with the fragment "%s"',
    (fragment) => {
      window.history.replaceState(null, '', `/office.html${fragment}`)
      expect(takeLaunchToken(window)).toBeNull()
    }
  )
})

describe('createWebBridge', () => {
  const fetchMock = vi.fn()
  const sent = (call = 0): { path: string; init: RequestInit } => ({
    path: fetchMock.mock.calls[call][0],
    init: fetchMock.mock.calls[call][1]
  })

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    // A page that already holds its session token, as after a reload.
    window.sessionStorage.setItem(TOKEN_KEY, TOKEN)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    window.sessionStorage.clear()
  })

  describe('a page opened with a launch code', () => {
    const session = (): Response => jsonReply({ success: true, token: TOKEN })

    beforeEach(() => window.sessionStorage.clear())

    it('trades the code once for a session token, which every call then carries', async () => {
      fetchMock.mockImplementation(async (path: string) =>
        path === '/api/session' ? session() : jsonReply({ success: true })
      )
      const bridge = createWebBridge(CODE)
      await Promise.all([bridge.focus('claude:s1'), bridge.focus('claude:s2')])

      expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
        '/api/session',
        '/api/focus',
        '/api/focus'
      ])
      expect(sent(0).init).toMatchObject({
        method: 'POST',
        headers: { Authorization: `Bearer ${CODE}` }
      })
      expect(sent(1).init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` })
      // Kept for a reload of this tab; the code itself is kept nowhere.
      expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe(TOKEN)
      expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(CODE)
    })

    it('opens the feed with the session token, never with the code', async () => {
      const feed = feedResponse()
      fetchMock.mockImplementation(async (path: string) =>
        path === '/api/session' ? session() : feed.response
      )
      const listener = vi.fn()
      const bridge = createWebBridge(CODE)
      bridge.onFeedMessage(listener)
      await bridge.ready()
      feed.write(`${JSON.stringify(hello)}\n`)

      await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(hello))
      expect(sent(1).path).toBe('/api/feed')
      expect(sent(1).init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
    })

    it.each([
      ['the code is refused', async () => new Response('', { status: 401 })],
      ['the server is gone', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['the answer carries no token', async () => jsonReply({ success: true })],
      ['the token is not a token', async () => jsonReply({ success: true, token: '<script>' })]
    ])('makes no other call when %s, and says the feed is stale', async (_case, answer) => {
      fetchMock.mockImplementation(answer)
      const listener = vi.fn()
      const bridge = createWebBridge(CODE)
      bridge.onFeedMessage(listener)
      await bridge.ready()

      expect(await bridge.send('claude:s1', 'hi')).toEqual({ success: false })
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/session'])
      expect(listener.mock.calls).toEqual([[{ type: 'resync' }]])
      expect(window.sessionStorage.length).toBe(0)
    })
  })

  describe('the feed', () => {
    it('opens the feed with the session token and delivers each message as it arrives', async () => {
      const feed = feedResponse()
      fetchMock.mockResolvedValue(feed.response)
      const listener = vi.fn()
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(listener)
      await bridge.ready()

      const line = JSON.stringify(patch)
      feed.write(`${JSON.stringify(hello)}\n${line.slice(0, 10)}`)
      feed.write(`${line.slice(10)}\n`)

      await vi.waitFor(() => expect(listener.mock.calls).toEqual([[hello], [patch]]))
      expect(sent().path).toBe('/api/feed')
      expect(sent().init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
    })

    it('ignores lines that are not feed messages', async () => {
      const feed = feedResponse()
      fetchMock.mockResolvedValue(feed.response)
      const listener = vi.fn()
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(listener)
      await bridge.ready()

      feed.write(`not json\n\n{"type":"hello","v":2}\n[1]\n${JSON.stringify(patch)}\n`)

      await vi.waitFor(() => expect(listener).toHaveBeenCalled())
      expect(listener.mock.calls).toEqual([[patch]])
    })

    it('marks its state stale when the feed drops, then reconnects to a fresh hello', async () => {
      const first = feedResponse()
      const second = feedResponse()
      fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response)
      const listener = vi.fn()
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(listener)
      await bridge.ready()

      first.end()
      await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({ type: 'resync' }))
      expect(fetchMock).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(1000)
      second.write(`${JSON.stringify(hello)}\n`)

      await vi.waitFor(() => expect(listener.mock.calls).toEqual([[{ type: 'resync' }], [hello]]))
    })

    it('keeps trying while the server cannot be reached', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(vi.fn())
      await bridge.ready()

      await vi.advanceTimersByTimeAsync(3000)

      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    it('leaves no abort listener behind for each wait between retries', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const added = vi.spyOn(AbortSignal.prototype, 'addEventListener')
      const removed = vi.spyOn(AbortSignal.prototype, 'removeEventListener')
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(vi.fn())
      await bridge.ready()

      await vi.advanceTimersByTimeAsync(10_000)

      const waits = added.mock.calls.filter(([type]) => type === 'abort').length
      const released = removed.mock.calls.filter(([type]) => type === 'abort').length
      expect(waits).toBeGreaterThanOrEqual(9)
      // Only the wait in progress may still be listening.
      expect(waits - released).toBeLessThanOrEqual(1)
    })

    it.each([401, 403])('stops for good when the server answers %i', async (status) => {
      fetchMock.mockResolvedValue(new Response('', { status }))
      const listener = vi.fn()
      const bridge = createWebBridge(TOKEN)
      bridge.onFeedMessage(listener)
      await bridge.ready()

      await vi.advanceTimersByTimeAsync(5000)

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(listener.mock.calls).toEqual([[{ type: 'resync' }]])
    })

    it('closes the feed when the last listener leaves, and opens it again on the next ready', async () => {
      fetchMock.mockImplementation(async () => feedResponse().response)
      const bridge = createWebBridge(TOKEN)
      const leave = bridge.onFeedMessage(vi.fn())
      await bridge.ready()
      await bridge.ready()
      expect(fetchMock).toHaveBeenCalledOnce()

      leave()
      expect(sent().init.signal?.aborted).toBe(true)
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetchMock).toHaveBeenCalledOnce()

      bridge.onFeedMessage(vi.fn())
      await bridge.ready()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('actions', () => {
    it('posts each action as JSON with the session token', async () => {
      fetchMock.mockImplementation(async () => jsonReply({ success: true }))
      const bridge = createWebBridge(TOKEN)

      await bridge.send('claude:s1', 'run the tests')
      await bridge.respond('claude:s1', 'deny', 'f1')
      await bridge.start('p_app', 'codex')
      await bridge.peek('claude:s1')
      await bridge.focus('claude:s1#lena')

      expect(fetchMock.mock.calls.map(([path, init]) => [path, JSON.parse(init.body)])).toEqual([
        ['/api/send', { sessionKey: 'claude:s1', text: 'run the tests' }],
        ['/api/respond', { sessionKey: 'claude:s1', decision: 'deny', fingerprint: 'f1' }],
        ['/api/start', { projectKey: 'p_app', provider: 'codex' }],
        ['/api/peek', { sessionKey: 'claude:s1' }],
        ['/api/focus', { agentKey: 'claude:s1#lena' }]
      ])
      expect(sent().init).toMatchObject({
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
      })
    })

    it('returns what the server answered, in the shapes the Office already reads', async () => {
      const bridge = createWebBridge(TOKEN)

      fetchMock.mockResolvedValueOnce(jsonReply({ success: false, reason: 'not-in-orca' }))
      expect(await bridge.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'not-in-orca'
      })

      fetchMock.mockResolvedValueOnce(jsonReply({ success: true, target: 'pane' }))
      expect(await bridge.focus('claude:s1')).toEqual({ success: true, target: 'pane' })

      // Orca came forward but the pane could not be proven: a failure that still says where.
      const appOnly = { success: false, reason: 'terminal-not-found', target: 'app' }
      fetchMock.mockResolvedValueOnce(jsonReply(appOnly))
      expect(await bridge.focus('claude:s1')).toEqual(appOnly)

      fetchMock.mockResolvedValueOnce(
        jsonReply({ success: true, lines: ['$ npm test', 7], fingerprint: 'f1' })
      )
      expect(await bridge.peek('claude:s1')).toEqual({
        success: true,
        lines: ['$ npm test'],
        fingerprint: 'f1'
      })
    })

    it('passes on a view-only refusal, so the Office can say the page is view-only', async () => {
      const refusal = (): Response => jsonReply({ success: false, reason: 'not-permitted' }, 403)
      fetchMock.mockImplementation(async () => refusal())
      const bridge = createWebBridge(TOKEN)
      const refused = { success: false, reason: 'not-permitted' }

      expect(await bridge.send('claude:s1', 'hi')).toEqual(refused)
      expect(await bridge.respond('claude:s1', 'approve', 'f1')).toEqual(refused)
      expect(await bridge.start('p_app', 'claude')).toEqual(refused)
      expect(await bridge.peek('claude:s1')).toEqual({ ...refused, lines: [] })
    })

    it.each([
      ['the server is gone', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['the answer is not JSON', async () => new Response('<html>', { status: 502 })],
      ['the answer is not an object', async () => jsonReply(['success'])],
      ['success is not exactly true', async () => jsonReply({ success: 'true', target: 'shell' })]
    ])('fails without throwing when %s', async (_name, answer) => {
      fetchMock.mockImplementation(answer)
      const bridge = createWebBridge(TOKEN)

      expect(await bridge.focus('claude:s1')).toEqual({ success: false })
      expect(await bridge.peek('claude:s1')).toEqual({ success: false, lines: [] })
    })
  })
})
