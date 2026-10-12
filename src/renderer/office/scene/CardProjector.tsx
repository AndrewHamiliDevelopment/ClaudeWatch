import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3, type Camera } from 'three'
import type { ZoomBand } from '../logic/camera-bands'
import { cullCards, type CullCandidate } from '../logic/card-culling'
import type { NameCard, ProjectStack } from '../logic/name-cards'
import { cardSafeArea } from '../logic/zone-framing'

// Over an agent's head (scene/Robot.tsx draws agents 1.65 m tall).
export const CARD_HEIGHT = 2.45
const PILL_HEIGHT = 1.55
const DOT_HEIGHT = 1.7
const STACK_HEIGHT = 2.6
export const OFFSCREEN = 'translate(-9999px, -9999px)'

export interface CardAnchors {
  cards: Map<string, HTMLElement>
  dots: Map<string, HTMLElement>
  stacks: Map<string, HTMLElement>
}

interface Size {
  width: number
  height: number
}

interface CardProjectorProps {
  cards: readonly NameCard[]
  stacks: readonly ProjectStack[]
  anchors: CardAnchors
  band: ZoomBand
  selectedAgentKey: string | null
}

// Writes a snapshot slot and returns 1 if it changed, so the idle check allocates nothing.
function store(snapshot: number[], index: number, value: number): number {
  const hasChanged = snapshot[index] !== value
  snapshot[index] = value
  return hasChanged ? 1 : 0
}

function hideAll(elements: Map<string, HTMLElement>): void {
  for (const element of elements.values()) element.style.transform = OFFSCREEN
}

// Runs inside the Canvas each projected frame: moves the DOM cards, and outside the desk band
// culls overlapping cards in screen space (card-culling.ts). Only style is written, never React state.
export function CardProjector({
  cards,
  stacks,
  anchors,
  band,
  selectedAgentKey
}: CardProjectorProps) {
  const point = useMemo(() => new Vector3(), [])
  // Element sizes change only with band or selection, so measure once per combination.
  const lastRef = useRef<{
    view: number[]
    cards: readonly NameCard[] | null
    stacks: readonly ProjectStack[] | null
    band: ZoomBand | null
    selectedAgentKey: string | null
  }>({ view: [], cards: null, stacks: null, band: null, selectedAgentKey: null })
  const sizes = useMemo(
    () => new WeakMap<HTMLElement, { key: string; width: number; height: number }>(),
    []
  )

  const toScreen = (camera: Camera, size: Size, x: number, y: number, z: number) => {
    point.set(x, y, z).project(camera)
    if (point.z >= 1 || Math.abs(point.x) > 1.1 || Math.abs(point.y) > 1.1) return null
    return { x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height }
  }
  const place = (element: HTMLElement | undefined, at: { x: number; y: number } | null): void => {
    if (!element) return
    element.style.transform = at
      ? `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`
      : OFFSCREEN
  }
  const measure = (element: HTMLElement, key: string) => {
    const cached = sizes.get(element)
    if (cached?.key === key) return cached
    const fresh = { key, width: element.offsetWidth, height: element.offsetHeight }
    sizes.set(element, fresh)
    return fresh
  }

  useFrame(({ camera, size }) => {
    // Cards only move when the camera, the viewport or the inputs change; skip idle frames.
    const zoom = 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1
    const { position, quaternion } = camera
    const last = lastRef.current
    const view = last.view
    const hasMoved =
      store(view, 0, position.x) |
      store(view, 1, position.y) |
      store(view, 2, position.z) |
      store(view, 3, quaternion.x) |
      store(view, 4, quaternion.y) |
      store(view, 5, quaternion.z) |
      store(view, 6, quaternion.w) |
      store(view, 7, zoom) |
      store(view, 8, size.width) |
      store(view, 9, size.height)
    const isSameView =
      hasMoved === 0 &&
      last.cards === cards &&
      last.stacks === stacks &&
      last.band === band &&
      last.selectedAgentKey === selectedAgentKey
    if (isSameView) return
    last.cards = cards
    last.stacks = stacks
    last.band = band
    last.selectedAgentKey = selectedAgentKey
    // camera-controls moves the camera after three last built its matrix, and the renderer only
    // rebuilds it after this callback: without this the cards trail the canvas while it turns.
    camera.updateMatrixWorld()

    if (band === 'desk') {
      for (const card of cards) {
        const height = card.kind === 'card' ? CARD_HEIGHT : PILL_HEIGHT
        place(anchors.cards.get(card.agentKey), toScreen(camera, size, card.x, height, card.z))
      }
      hideAll(anchors.dots)
      hideAll(anchors.stacks)
      return
    }

    const candidates: CullCandidate[] = []
    const positions = new Map<string, { x: number; y: number }>()
    for (const card of cards) {
      const element = anchors.cards.get(card.agentKey)
      const isSelected = card.agentKey === selectedAgentKey
      const at = toScreen(
        camera,
        size,
        card.x,
        card.kind === 'card' ? CARD_HEIGHT : PILL_HEIGHT,
        card.z
      )
      // Apprentice pills only show up close; the selected one always does.
      if (!element || !at || (card.kind === 'pill' && !isSelected)) {
        place(element, null)
        continue
      }
      const { width, height } = measure(element, `${band}:${isSelected}`)
      positions.set(card.agentKey, at)
      candidates.push({
        agentKey: card.agentKey,
        projectKey: card.projectKey,
        status: card.status,
        updatedAtMs: card.updatedAtMs,
        isSelected,
        rect: { left: at.x - width / 2, right: at.x + width / 2, top: at.y - height, bottom: at.y }
      })
    }

    const outcome = cullCards(candidates, cardSafeArea(size))
    for (const card of cards) {
      const isShown = outcome.cards.has(card.agentKey)
      if (positions.has(card.agentKey))
        place(
          anchors.cards.get(card.agentKey),
          isShown ? (positions.get(card.agentKey) ?? null) : null
        )
      const dot = outcome.dots.has(card.agentKey)
        ? toScreen(camera, size, card.x, DOT_HEIGHT, card.z)
        : null
      place(anchors.dots.get(card.agentKey), dot)
    }
    for (const stack of stacks) {
      const isStacked = outcome.stackedProjects.has(stack.projectKey)
      place(
        anchors.stacks.get(stack.projectKey),
        isStacked ? toScreen(camera, size, stack.x, STACK_HEIGHT, stack.z) : null
      )
    }
  })
  return null
}
