import { describe, it, expect } from 'vitest'
import { projectKey } from './project-key'

describe('projectKey', () => {
  it('is stable for the same project root', () => {
    expect(projectKey('/Users/dev/ClaudeWatch')).toBe(projectKey('/Users/dev/ClaudeWatch'))
  })

  it('prefixes a 16-digit hex FNV-1a hash', () => {
    expect(projectKey('/Users/dev/ClaudeWatch')).toMatch(/^p_[0-9a-f]{16}$/)
  })

  it('ignores trailing slashes', () => {
    expect(projectKey('/Users/dev/ClaudeWatch/')).toBe(projectKey('/Users/dev/ClaudeWatch'))
  })

  it('separates different roots', () => {
    expect(projectKey('/Users/dev/a')).not.toBe(projectKey('/Users/dev/b'))
  })

  it('matches the FNV-1a 64-bit reference value for the empty string', () => {
    expect(projectKey('')).toBe('p_cbf29ce484222325')
  })
})
