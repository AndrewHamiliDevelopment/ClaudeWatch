import { createHash } from 'node:crypto'
import type { ProviderId } from '../shared/office/types'

// How an account is named in feeds, files and logs: one-way, so the provider's id never travels.
export const accountKey = (provider: ProviderId, providerAccountId: string): string =>
  `${provider}:${createHash('sha256').update(providerAccountId).digest('hex').slice(0, 12)}`
