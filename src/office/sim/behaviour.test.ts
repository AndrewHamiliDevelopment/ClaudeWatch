import { expect, it } from 'vitest'
import { createAgent, updateAgent, tickAgent } from './behaviour'
import { session } from './fixtures'

it('starts the done dwell at arrival and does not restart it on duplicate updates', () => {
  let agent = createAgent(
    { ...session('a'), attention: 'done' },
    { floorId: 'p_a', roomId: 'a', slotId: 'desk_main', x: 1, z: 0, heading: 0 },
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 }
    ]
  )
  agent = tickAgent(agent, 2000)
  expect(agent.state).toBe('done')
  agent = tickAgent(agent, 1000)
  agent = updateAgent(agent, 'idle', 'done')
  expect(tickAgent(agent, 500).state).toBe('working')
})

it('finishes arriving when attention changes while walking', () => {
  let agent = createAgent(
    session('a'),
    { floorId: 'p_a', roomId: 'a', slotId: 'desk_main', x: 1, z: 0, heading: 0 },
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 }
    ]
  )
  agent = updateAgent(agent, 'reading', 'question')
  expect(agent.view.attention).toBe('question')
  agent = tickAgent(agent, 1000)
  expect(agent.view.x).toBe(1)
  expect(agent.state).toBe('needs_you')
  expect(agent.view.heading).toBe(Math.PI)
})

it('shows done briefly, then resumes working', () => {
  let agent = createAgent(
    session('a'),
    { floorId: 'p_a', roomId: 'a', slotId: 'desk_main', x: 0, z: 0, heading: 0 },
    []
  )
  agent = updateAgent(tickAgent(agent, 0), 'idle', 'done')
  expect(tickAgent(agent, 1400).state).toBe('done')
  expect(tickAgent(agent, 1500).state).toBe('working')
})

it('coalesces activities until the 1.5 second dwell ends', () => {
  let agent = createAgent(
    session('a'),
    { floorId: 'p_a', roomId: 'a', slotId: 'desk_main', x: 0, z: 0, heading: 0 },
    [{ x: 0, z: 0 }]
  )
  agent = tickAgent(agent, 0)
  agent = updateAgent(agent, 'reading', 'none')
  agent = tickAgent(agent, 500)
  agent = updateAgent(agent, 'editing', 'none')
  agent = tickAgent(agent, 500)
  agent = updateAgent(agent, 'running', 'none')
  expect(agent.view.activity).toBe('idle')
  expect(tickAgent(agent, 500).view.activity).toBe('running')
})
it('applies attention immediately and faces the camera', () => {
  const agent = createAgent(
    session('a'),
    { floorId: 'p_a', roomId: 'a', slotId: 'desk_main', x: 0, z: 0, heading: 0 },
    []
  )
  const next = updateAgent(agent, 'editing', 'permission')
  expect(next.state).toBe('needs_you')
  expect(next.view.heading).toBe(Math.PI)
  expect(next.view.attention).toBe('permission')
})
