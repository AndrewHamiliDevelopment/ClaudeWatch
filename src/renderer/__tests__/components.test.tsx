import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBadge } from '../components/StatusBadge'
import { ProjectTag } from '../components/ProjectTag'
import { InstanceList } from '../components/InstanceList'
import { Header, type ViewType } from '../components/Header'
import type { ClaudeInstance } from '../lib/types'

const mockInstance = (overrides: Partial<ClaudeInstance> = {}): ClaudeInstance => ({
  pid: 1234,
  tty: '/dev/ttys001',
  status: 'active',
  cpuPercent: 12.5,
  memPercent: 3.2,
  elapsedTime: '5:30',
  elapsedSeconds: 330,
  projectPath: '/Users/test/projects/my-app',
  projectName: 'projects/my-app',
  flags: ['--model', 'opus'],
  sessionId: 'abc-123',
  startedAt: new Date('2026-03-18T10:00:00'),
  lastStatusChange: new Date('2026-03-18T10:05:00'),
  ...overrides
})

describe('StatusBadge', () => {
  it('renders active status with correct label', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Active')
  })

  it('renders idle status', () => {
    render(<StatusBadge status="idle" />)
    expect(screen.getByText('Idle')).toBeTruthy()
  })

  it('renders exited status', () => {
    render(<StatusBadge status="exited" />)
    expect(screen.getByText('Exited')).toBeTruthy()
  })
})

describe('ProjectTag', () => {
  it('renders project name and has tooltip with full path', () => {
    render(<ProjectTag projectName="projects/my-app" projectPath="/Users/test/projects/my-app" />)
    expect(screen.getByText('projects/my-app')).toBeTruthy()
    expect(screen.getByLabelText('Project: /Users/test/projects/my-app')).toBeTruthy()
  })
})

describe('InstanceList', () => {
  it('renders empty state when no instances', () => {
    render(<InstanceList instances={[]} />)
    expect(screen.getByText('No instances found')).toBeTruthy()
  })

  it('renders instance cards when populated', () => {
    const instances = [mockInstance({ pid: 1 }), mockInstance({ pid: 2, status: 'idle' })]
    render(<InstanceList instances={instances} />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
  })
})

describe('Header', () => {
  it('highlights the current view', () => {
    render(<Header currentView="dashboard" onViewChange={() => {}} />)
    const dashboardBtn = screen.getByLabelText('Dashboard')
    expect(dashboardBtn.getAttribute('aria-current')).toBe('page')

    const historyBtn = screen.getByLabelText('History')
    expect(historyBtn.getAttribute('aria-current')).toBeNull()
  })

  it('calls onViewChange when nav button is clicked', () => {
    const onViewChange = vi.fn()
    render(<Header currentView="dashboard" onViewChange={onViewChange} />)

    fireEvent.click(screen.getByLabelText('Settings'))
    expect(onViewChange).toHaveBeenCalledWith('settings')
  })
})
