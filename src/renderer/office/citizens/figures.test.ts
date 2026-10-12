import { Box3, Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { listThemes } from '../themes/registry'
import { citizenFigures, citizenGeometry } from './figures'

// A citizen's crown is at 1.3 m, under an agent's 1.65 m; only what it carries (a parasol, a
// banner, a lamp pole) reaches higher.
const TALLEST_CITIZEN_M = 1.75
const FLOAT_SLACK_M = 1e-6

describe.each(listThemes().map((theme) => [theme.label, theme] as const))(
  'the townsfolk of %s',
  (_label, theme) => {
    const figures = citizenFigures(theme.id)

    it('has at least four different figures, each with its own name', () => {
      expect(figures.length).toBeGreaterThanOrEqual(4)
      expect(new Set(figures.map((figure) => figure.name)).size).toBe(figures.length)
    })

    it.each(figures.map((figure) => [figure.name, figure] as const))(
      'draws %s as one vertex-coloured buffer, on the ground and smaller than an agent',
      (_name, figure) => {
        const geometry = citizenGeometry(figure)
        const positions = geometry.getAttribute('position')
        expect(geometry.getAttribute('color').count).toBe(positions.count)
        expect(geometry.getAttribute('normal').count).toBe(positions.count)
        const box = new Box3().setFromObject(new Mesh(geometry))
        expect(box.min.y).toBeGreaterThan(-FLOAT_SLACK_M)
        expect(box.min.y).toBeLessThan(0.05)
        expect(box.max.y).toBeLessThanOrEqual(TALLEST_CITIZEN_M)
        expect(box.max.y).toBeGreaterThan(0.2)
        geometry.dispose()
      }
    )
  }
)

describe('citizenFigures', () => {
  it('shares no figure name between two themes', () => {
    const names = listThemes().flatMap((theme) => citizenFigures(theme.id).map(({ name }) => name))
    expect(new Set(names).size).toBe(names.length)
  })

  it('dresses a theme it does not know as the default town', () => {
    expect(citizenFigures('a-plug-in-theme')).toBe(citizenFigures('neo-edo-steam'))
  })
})
