import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { makeFloor, makeZone } from '../__tests__/fixtures'
import { ZonePickers } from './ZonePickers'

interface PlateProps {
  onPointerDown: (event: { clientX: number; clientY: number }) => void
  onClick: (event: { clientX: number; clientY: number }) => void
}

// Expands function components by hand: the plates need no canvas to be exercised.
function plates(node: ReactNode): ReactElement<PlateProps>[] {
  if (Array.isArray(node)) return node.flatMap(plates)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  if (typeof node.type === 'function') {
    return plates((node.type as (props: unknown) => ReactNode)(node.props))
  }
  if (node.type === 'mesh') return [node as ReactElement<PlateProps>]
  return plates(node.props.children)
}

const floor = makeFloor({
  floorId: 'hq',
  zones: [
    makeZone({
      id: 'company',
      kind: 'company',
      children: [makeZone({ id: 'project', kind: 'project' })]
    })
  ]
})

describe('ZonePickers', () => {
  it('clears the selection on a click on bare floor inside a zone, but not after a drag', () => {
    const onMiss = vi.fn()
    const [company, project] = plates(ZonePickers({ floor, onFly: vi.fn(), onMiss }))
    expect(project).toBeDefined()

    company.props.onPointerDown({ clientX: 100, clientY: 100 })
    company.props.onClick({ clientX: 101, clientY: 100 })
    expect(onMiss).toHaveBeenCalledOnce()

    // Panning the map ends with a click event on the plate under the pointer.
    project.props.onPointerDown({ clientX: 100, clientY: 100 })
    project.props.onClick({ clientX: 180, clientY: 140 })
    expect(onMiss).toHaveBeenCalledOnce()
  })
})
