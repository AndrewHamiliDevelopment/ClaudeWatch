import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { PopoverView } from '../components/PopoverView'
import type { ClaudeInstance, InstanceUpdate } from '../lib/types'
import { mockApi } from './api-mock'

const instance = (overrides: Partial<ClaudeInstance>): ClaudeInstance => ({
  pid: 4321,
  tty: '/dev/ttys002',
  status: 'active',
  cpuPercent: 20,
  memPercent: 2,
  elapsedTime: '1:00',
  elapsedSeconds: 60,
  projectPath: '/Users/test/projects/app',
  projectName: 'projects/app',
  flags: [],
  sessionId: 's-1',
  startedAt: new Date('2026-10-11T10:00:00'),
  lastStatusChange: new Date('2026-10-11T10:00:30'),
  ...overrides
})

const update = (instances: ClaudeInstance[]): InstanceUpdate => ({
  instances,
  stats: { total: instances.length, active: 1, idle: 0, stale: 0, exited: 0, recentlyCompleted: 0 }
})

describe('PopoverView status icon', () => {
  beforeEach(() => {
    window.api = mockApi({
      getInstances: vi.fn().mockResolvedValue(update([instance({ status: 'active' })]))
    })
  })

  it('colours an active session icon with the active status class', async () => {
    render(<PopoverView />)
    const icon = await screen.findByLabelText('active')
    expect(icon.getAttribute('class')).toContain('text-status-active')
    expect(icon.getAttribute('class')).not.toContain('[object Object]')
  })
})
