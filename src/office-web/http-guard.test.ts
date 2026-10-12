import { describe, expect, it } from 'vitest'
import { guardRequest, SECURITY_HEADERS } from './http-guard'

const TOKEN = 'k'.repeat(43)
const CODE = 'c'.repeat(43)
const config = { port: 5199, launchCode: CODE, sessionToken: TOKEN }
const HOST = '127.0.0.1:5199'
const ORIGIN = 'http://127.0.0.1:5199'
const bearer = { authorization: `Bearer ${TOKEN}` }

describe('guardRequest', () => {
  it.each([
    ['a page file', 'GET', '/office.html', { host: HOST }, false],
    ['a page file with a query', 'GET', '/assets/office.js?v=1', { host: HOST }, false],
    ['the feed, as a same-origin fetch sends it', 'GET', '/api/feed', feedHeaders(), true],
    ['the feed from a local tool holding the token', 'GET', '/api/feed', tokenOnly(), true],
    ['an action from the page', 'POST', '/api/focus', actionHeaders(), true]
  ])('allows %s', (_name, method, url, headers, isApi) => {
    expect(guardRequest({ method, url, headers }, config)).toEqual({
      allowed: true,
      path: url.split('?')[0],
      isApi
    })
  })

  it.each([
    ['localhost', 'localhost:5199'],
    ['a rebound DNS name', 'evil.test:5199'],
    ['another loopback port', '127.0.0.1:5200'],
    ['the address without its port', '127.0.0.1'],
    ['a missing Host', undefined]
  ])('refuses a request addressed to %s', (_name, host) => {
    for (const url of ['/office.html', '/api/feed']) {
      const headers = { ...feedHeaders(), host }
      expect(guardRequest({ method: 'GET', url, headers }, config)).toEqual({
        allowed: false,
        status: 403
      })
    }
  })

  it.each([
    ['another loopback port', 'http://127.0.0.1:5173'],
    ['localhost', 'http://localhost:5199'],
    ['a website', 'https://evil.test'],
    ['an opaque origin', 'null']
  ])('refuses an API call whose Origin is %s', (_name, origin) => {
    for (const method of ['GET', 'POST']) {
      const headers = { ...actionHeaders(), origin }
      expect(guardRequest({ method, url: '/api/focus', headers }, config)).toEqual({
        allowed: false,
        status: 403
      })
    }
  })

  it('refuses a POST that names no Origin, which every browser sends', () => {
    expect(
      guardRequest({ method: 'POST', url: '/api/focus', headers: tokenOnly() }, config)
    ).toEqual({ allowed: false, status: 403 })
  })

  it.each(['cross-site', 'same-site', 'none'])(
    'refuses an API call the browser marks as %s',
    (site) => {
      const headers = { ...feedHeaders(), 'sec-fetch-site': site }
      expect(guardRequest({ method: 'GET', url: '/api/feed', headers }, config)).toEqual({
        allowed: false,
        status: 403
      })
    }
  )

  it.each([
    ['no token', undefined],
    ['a wrong token', `Bearer ${'x'.repeat(43)}`],
    ['a token of the wrong length', `Bearer ${TOKEN}k`],
    ['the token without its scheme', TOKEN],
    ['an empty bearer', 'Bearer ']
  ])('refuses an API call with %s', (_name, authorization) => {
    const headers = { ...feedHeaders(), authorization }
    expect(guardRequest({ method: 'GET', url: '/api/feed', headers }, config)).toEqual({
      allowed: false,
      status: 401
    })
  })

  describe('the launch code and the session token', () => {
    const post = (
      url: string,
      credential: string,
      at: Parameters<typeof guardRequest>[1] = config
    ): unknown =>
      guardRequest(
        {
          method: 'POST',
          url,
          headers: { ...actionHeaders(), authorization: `Bearer ${credential}` }
        },
        at
      )
    const refused = { allowed: false, status: 401 }

    it('takes the code only where it is traded, and the token everywhere else', () => {
      expect(post('/api/session', CODE)).toMatchObject({ allowed: true, path: '/api/session' })
      expect(post('/api/session', TOKEN)).toEqual(refused)
      expect(post('/api/focus', TOKEN)).toMatchObject({ allowed: true })
      expect(post('/api/focus', CODE)).toEqual(refused)
    })

    it('takes neither once the code is spent, or before a session exists', () => {
      const spent = { ...config, launchCode: null }
      const unopened = { ...config, sessionToken: null }
      expect(post('/api/session', CODE, spent)).toEqual(refused)
      expect(post('/api/focus', TOKEN, unopened)).toEqual(refused)
      expect(post('/api/focus', 'null', unopened)).toEqual(refused)
      expect(post('/api/focus', '', unopened)).toEqual(refused)
    })
  })

  it('asks for no token on page files, which hold no data', () => {
    expect(
      guardRequest({ method: 'GET', url: '/office.html', headers: { host: HOST } }, config)
    ).toMatchObject({ allowed: true })
  })

  it.each(['OPTIONS', 'PUT', 'DELETE', 'PATCH', 'HEAD', undefined])(
    'refuses the %s method, so a cross-origin preflight can never pass',
    (method) => {
      expect(guardRequest({ method, url: '/api/send', headers: actionHeaders() }, config)).toEqual({
        allowed: false,
        status: 405
      })
    }
  )

  it('refuses a POST to a page file', () => {
    expect(
      guardRequest({ method: 'POST', url: '/office.html', headers: actionHeaders() }, config)
    ).toEqual({ allowed: false, status: 405 })
  })
})

describe('SECURITY_HEADERS', () => {
  it('forbid framing, so no other page can overlay the Office’s buttons', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('never grant cross-origin access', () => {
    const names = Object.keys(SECURITY_HEADERS).map((name) => name.toLowerCase())
    expect(names.filter((name) => name.startsWith('access-control-'))).toEqual([])
  })
})

function tokenOnly(): Record<string, string> {
  return { host: HOST, ...bearer }
}

function feedHeaders(): Record<string, string> {
  return { ...tokenOnly(), 'sec-fetch-site': 'same-origin' }
}

function actionHeaders(): Record<string, string> {
  return { ...feedHeaders(), origin: ORIGIN }
}
