import { describe, expect, it } from 'vitest'
import { ISO_START_AZIMUTH } from '../logic/camera-bands'
import { projectToScreen } from '../logic/zone-framing'
import { makeAgent } from '../__tests__/fixtures'
import {
  agentInReach,
  createPlayer,
  heldDirection,
  MAX_FRAME_SEC,
  screenMove,
  stepWalk,
  tickPlayer,
  WALK_SPEED_M_PER_SEC
} from './walking'
import type { WalkGround } from './walk-ground'

const QUARTER_TURN = Math.PI / 2
const FRAME_SEC = 1 / 60
const VIEWPORT = { width: 1200, height: 800 }

// Open everywhere west of a wall that stands at x = 2.
const walled: Pick<WalkGround, 'isOpen'> = { isOpen: (point) => point.x < 2 }
const open: Pick<WalkGround, 'isOpen'> = { isOpen: () => true }

function onScreen(point: { x: number; z: number }, azimuth: number) {
  return projectToScreen({ ...point, y: 0 }, { target: [0, 0, 0], zoom: 30, azimuth }, VIEWPORT)
}

describe('heldDirection', () => {
  it('reads arrows and W A S D alike', () => {
    expect(heldDirection(new Set(['ArrowUp']))).toEqual({ x: 0, y: 1 })
    expect(heldDirection(new Set(['w']))).toEqual({ x: 0, y: 1 })
    expect(heldDirection(new Set(['a', 's']))).toEqual({ x: -1, y: -1 })
    expect(heldDirection(new Set(['ArrowRight']))).toEqual({ x: 1, y: 0 })
  })

  it('is nothing when no key or opposite keys are held', () => {
    expect(heldDirection(new Set())).toBeNull()
    expect(heldDirection(new Set(['a', 'd']))).toBeNull()
  })
})

describe('screenMove', () => {
  const rotations = [0, 1, 2, 3].map((turn) => ISO_START_AZIMUTH + turn * QUARTER_TURN)

  it.each(rotations)('moves up the screen for "up" at map rotation %f', (azimuth) => {
    const move = screenMove({ x: 0, y: 1 }, azimuth)
    const from = onScreen({ x: 0, z: 0 }, azimuth)
    const to = onScreen(move, azimuth)
    expect(to.x).toBeCloseTo(from.x)
    expect(to.y).toBeLessThan(from.y)
  })

  it.each(rotations)('moves right on the screen for "right" at map rotation %f', (azimuth) => {
    const move = screenMove({ x: 1, y: 0 }, azimuth)
    const from = onScreen({ x: 0, z: 0 }, azimuth)
    const to = onScreen(move, azimuth)
    expect(to.y).toBeCloseTo(from.y)
    expect(to.x).toBeGreaterThan(from.x)
  })

  it('covers the same ground on a diagonal as on a straight', () => {
    const move = screenMove({ x: 1, y: 1 }, ISO_START_AZIMUTH)
    expect(Math.hypot(move.x, move.z)).toBeCloseTo(1)
  })
})

describe('stepWalk', () => {
  it('stops at a wall instead of passing through it', () => {
    const end = stepWalk({ x: 0, z: 0 }, { x: 1, z: 0 }, 50, walled.isOpen)
    expect(end.x).toBeLessThan(2)
    expect(end.x).toBeGreaterThan(1.5)
    expect(end.z).toBe(0)
  })

  it('slides along a wall it is pushed against at an angle', () => {
    const diagonal = { x: Math.SQRT1_2, z: Math.SQRT1_2 }
    const end = stepWalk({ x: 1.9, z: 0 }, diagonal, 1, walled.isOpen)
    expect(end.x).toBeLessThan(2)
    expect(end.z).toBeGreaterThan(0.5)
  })
})

describe('tickPlayer', () => {
  it('walks at the walking pace while a key is held', () => {
    const player = createPlayer({ x: 0, z: 0 })
    player.held.add('ArrowRight')
    for (let frame = 0; frame < 60; frame++) tickPlayer(player, open, FRAME_SEC, 0)
    expect(player.position.x).toBeCloseTo(WALK_SPEED_M_PER_SEC, 5)
    expect(player.position.z).toBeCloseTo(0)
  })

  it('stops at a wall, and then asks for no more frames', () => {
    const player = createPlayer({ x: 0, z: 0 })
    player.held.add('d')
    let frames = 0
    while (tickPlayer(player, walled, FRAME_SEC, 0) && frames < 600) frames++
    expect(frames).toBeLessThan(600)
    expect(player.position.x).toBeLessThan(2)
    expect(tickPlayer(player, walled, FRAME_SEC, 0)).toBe(false)
  })

  it('asks for no frame while standing still', () => {
    expect(tickPlayer(createPlayer({ x: 0, z: 0 }), open, FRAME_SEC, 0)).toBe(false)
  })

  it('walks its path at the same pace and stops at the end', () => {
    const player = createPlayer({ x: 0, z: 0 })
    player.path = [
      { x: 2, z: 0 },
      { x: 2, z: 2 }
    ]
    expect(tickPlayer(player, open, 0.05, 0)).toBe(true)
    expect(player.position.x).toBeCloseTo(WALK_SPEED_M_PER_SEC * 0.05)
    let frames = 0
    while (tickPlayer(player, open, FRAME_SEC, 0) && frames < 600) frames++
    expect(player.position).toEqual({ x: 2, z: 2 })
    expect(player.path).toEqual([])
    const seconds = (frames + 1) * FRAME_SEC + 0.05
    expect(seconds).toBeCloseTo(4 / WALK_SPEED_M_PER_SEC, 1)
  })

  it('drops its path when the owner takes the keys', () => {
    const player = createPlayer({ x: 0, z: 0 })
    player.path = [{ x: 9, z: 0 }]
    player.held.add('ArrowLeft')
    tickPlayer(player, open, FRAME_SEC, 0)
    expect(player.path).toEqual([])
    expect(player.position.x).toBeLessThan(0)
  })

  it('faces the way it walks', () => {
    const player = createPlayer({ x: 0, z: 0 })
    player.held.add('ArrowRight')
    tickPlayer(player, open, FRAME_SEC, 0)
    expect(Math.sin(player.heading)).toBeCloseTo(1)
  })

  it('keeps the pace on a slow machine, and never takes a stalled frame for a long walk', () => {
    const slow = createPlayer({ x: 0, z: 0 })
    slow.held.add('ArrowRight')
    for (let frame = 0; frame < 5; frame++) tickPlayer(slow, open, 0.2, 0)
    expect(slow.position.x).toBeCloseTo(WALK_SPEED_M_PER_SEC, 5)

    const player = createPlayer({ x: 0, z: 0 })
    player.held.add('ArrowRight')
    tickPlayer(player, open, 5, 0)
    expect(player.position.x).toBeLessThanOrEqual(WALK_SPEED_M_PER_SEC * MAX_FRAME_SEC + 1e-9)
  })
})

describe('agentInReach', () => {
  const agents = [
    makeAgent({ agentKey: 'near', x: 1, z: 1 }),
    makeAgent({ agentKey: 'nearer', x: 0.5, z: 0 }),
    makeAgent({ agentKey: 'far', x: 6, z: 0 })
  ]

  it('names the nearest agent within about two metres', () => {
    expect(agentInReach({ x: 0, z: 0 }, agents)?.agentKey).toBe('nearer')
    expect(agentInReach({ x: 4.5, z: 0 }, agents)?.agentKey).toBe('far')
  })

  it('names nobody when all are farther away', () => {
    expect(agentInReach({ x: 0, z: 20 }, agents)).toBeNull()
  })
})
