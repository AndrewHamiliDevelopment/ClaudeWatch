import type { IncomingHttpHeaders } from 'node:http'
import { isLaunchToken } from './launch-token'

// Sent on every response. No Access-Control-* header exists anywhere in the server, so no
// other origin can read a response or pass a preflight.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // File names carry no content hash, so a cached copy could outlive the bundle it came from.
  'Cache-Control': 'no-store'
}

interface GuardConfig {
  port: number
  token: string
}

interface GuardedRequest {
  method?: string
  url?: string
  headers: IncomingHttpHeaders
}

export type GuardVerdict =
  | { allowed: true; path: string; isApi: boolean }
  | { allowed: false; status: 401 | 403 | 405 }

const refuse = (status: 401 | 403 | 405): GuardVerdict => ({ allowed: false, status })

// Rebuilds for a loopback port what frame identity gives the Electron window: only this
// server's own page, opened by this launch, may reach the API.
export function guardRequest(request: GuardedRequest, config: GuardConfig): GuardVerdict {
  const { method, headers } = request
  if (method !== 'GET' && method !== 'POST') return refuse(405)
  // The literal address only: a DNS name is never accepted, so rebinding has nothing to bind.
  if (headers.host !== `127.0.0.1:${config.port}`) return refuse(403)

  const path = (request.url ?? '').split('?')[0]
  if (!path.startsWith('/api/')) {
    return method === 'GET' ? { allowed: true, path, isApi: false } : refuse(405)
  }

  const { origin } = headers
  const isOwnOrigin = origin === `http://127.0.0.1:${config.port}`
  // Browsers omit Origin on a same-origin GET but always send it with a POST.
  if (origin === undefined ? method === 'POST' : !isOwnOrigin) return refuse(403)
  const fetchSite = headers['sec-fetch-site']
  if (fetchSite !== undefined && fetchSite !== 'same-origin') return refuse(403)

  const [scheme, presented] = (headers.authorization ?? '').split(' ')
  if (scheme !== 'Bearer' || !isLaunchToken(config.token, presented)) return refuse(401)
  return { allowed: true, path, isApi: true }
}
