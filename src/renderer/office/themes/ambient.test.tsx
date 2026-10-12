import { createElement, type ReactNode } from 'react'
import { Group } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { moveSteam, steamPuffAt } from './ambient-parts'
import { BrassAmbient, brassGears, brassSteamStacks, turnGears } from './BrassAmbient'
import { dronePosition, EdoAmbient, edoSteamStacks, lanternDrones } from './EdoAmbient'
import { surroundingLots } from './surroundings'
import type { AmbientProps } from './types'

type FrameState = { clock: { elapsedTime: number }; invalidate: () => void }
const frame = vi.hoisted(() => ({
  callbacks: [] as ((state: FrameState) => void)[],
  root: null as Group | null
}))
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: FrameState) => void) => frame.callbacks.push(callback)
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useRef: () => ({ current: frame.root })
}))

const floor = buildFixtureFrame(0, 0).floors[0]
const lots = surroundingLots(floor)
const lotById = new Map(lots.map((lot) => [lot.id, lot]))
const TIMES = Array.from({ length: 120 }, (_, index) => index * 0.37)

beforeEach(() => {
  frame.callbacks.length = 0
})

function groupOf(childCount: number): Group {
  const root = new Group()
  for (let index = 0; index < childCount; index++) root.add(new Group())
  return root
}

const placesOf = (root: Group): number[][] =>
  root.children.map((child) => [...child.position.toArray(), child.rotation.z, child.scale.x])

describe('lantern drones', () => {
  const drones = lanternDrones(lots, floor)

  it('patrol a handful of lots, the same ones on every start', () => {
    expect(drones.length).toBeGreaterThan(2)
    expect(drones.length).toBeLessThanOrEqual(10)
    expect(lanternDrones(lots, floor)).toEqual(drones)
  })

  it('stay beside their lot and under its height limit while they drift', () => {
    for (const drone of drones) {
      const lot = lotById.get(drone.lotId)
      if (!lot) throw new Error('drone without a lot')
      const seen = new Set<string>()
      for (const time of TIMES) {
        const [x, y, z] = dronePosition(drone, time)
        seen.add(`${x.toFixed(1)}:${z.toFixed(1)}`)
        expect(Math.abs(x - lot.x)).toBeLessThanOrEqual(lot.width / 2 + 0.5)
        expect(Math.abs(z - lot.z)).toBeLessThanOrEqual(lot.depth / 2 + 0.5)
        expect(y + 0.3).toBeLessThanOrEqual(lot.maxHeight)
      }
      expect(seen.size).toBeGreaterThan(20)
    }
  })
})

describe('rising steam', () => {
  it('lifts and swells each puff, then lets it vanish before the next', () => {
    const lifts = TIMES.map((time) => steamPuffAt(time, 0))
    expect(Math.min(...lifts.map((puff) => puff.size))).toBeLessThan(0.1)
    expect(Math.max(...lifts.map((puff) => puff.size))).toBeLessThanOrEqual(1.1)
    for (const puff of lifts) {
      expect(puff.lift).toBeGreaterThanOrEqual(0)
      expect(puff.lift).toBeLessThan(1)
    }
  })

  it.each([
    ['Neo Edo Steam', edoSteamStacks],
    ['Brass Workshop', brassSteamStacks]
  ])('%s keeps every puff under its lot limit', (_name, stacksOf) => {
    const stacks = stacksOf(lots, floor)
    expect(stacks.length).toBeGreaterThan(0)
    expect(stacks.length).toBeLessThanOrEqual(8)
    const root = groupOf(stacks.length * 3)
    for (const time of TIMES) {
      moveSteam(root, stacks, time)
      root.children.forEach((puff, index) => {
        const stack = stacks[Math.floor(index / 3)]
        expect(puff.position.y + puff.scale.y / 2).toBeLessThanOrEqual(stack.y + stack.rise + 1e-6)
        expect(puff.position.y).toBeGreaterThanOrEqual(stack.y)
      })
    }
  })
})

describe('tower gears', () => {
  it('turn in place on the towers that have them', () => {
    const gears = brassGears(lots, floor)
    expect(gears.length).toBeGreaterThan(0)
    expect(gears.length).toBeLessThanOrEqual(16)
    const root = groupOf(gears.length)
    turnGears(root, 1)
    const before = placesOf(root)
    turnGears(root, 2)
    const after = placesOf(root)
    after.forEach((place, index) => {
      expect(place.slice(0, 3)).toEqual(before[index].slice(0, 3))
      expect(place[3]).not.toBe(before[index][3])
    })
  })
})

describe.each([
  ['Neo Edo Steam', EdoAmbient],
  ['Brass Workshop', BrassAmbient]
])('%s ambient part', (_name, Ambient) => {
  // Expands the part and its children so every useFrame in it registers.
  function mount(isReducedMotion: boolean): Group {
    const root = groupOf(60)
    frame.root = root
    const expand = (node: ReactNode): void => {
      if (Array.isArray(node)) return node.forEach(expand)
      if (!node || typeof node !== 'object' || !('type' in node)) return
      const { type, props } = node as { type: unknown; props: { children?: ReactNode } }
      if (typeof type === 'function') return expand((type as (p: object) => ReactNode)(props))
      expand(props.children)
    }
    const props: AmbientProps = { floor, lots, isReducedMotion }
    expand(createElement(Ambient, props))
    return root
  }

  function run(time: number): () => void {
    const invalidate = vi.fn()
    for (const callback of frame.callbacks) callback({ clock: { elapsedTime: time }, invalidate })
    return invalidate
  }

  it('moves two kinds of thing each frame and never asks for another frame', () => {
    const root = mount(false)
    expect(frame.callbacks.length).toBeGreaterThanOrEqual(2)
    const invalidate = run(1)
    const before = placesOf(root)
    run(2.3)
    expect(placesOf(root)).not.toEqual(before)
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('holds everything still under reduced motion', () => {
    const root = mount(true)
    const before = placesOf(root)
    run(1)
    run(2.3)
    expect(placesOf(root)).toEqual(before)
  })
})
