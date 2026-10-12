import { describe, it, expect } from 'vitest'
import { projectKey, projectRootOf } from './project-key'

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

describe('projectRootOf', () => {
  it.each([
    ['/Users/dev/App/.claude/.worktree/fix-login', '/Users/dev/App'],
    ['/Users/dev/App/.claude/worktrees/agent-a1/src/main', '/Users/dev/App'],
    ['C:\\dev\\App\\.claude\\worktrees\\agent-a1', 'C:\\dev\\App']
  ])('strips an agent worktree folder from %s', (path, root) => {
    expect(projectRootOf(path)).toBe(root)
  })

  it('leaves a path outside a worktree as it is', () => {
    expect(projectRootOf('/Users/dev/App')).toBe('/Users/dev/App')
    expect(projectRootOf('/Users/dev/App/.claude/skills')).toBe('/Users/dev/App/.claude/skills')
  })
})
