import type { OfficeTheme } from '../themes/types'
import { fallbackVehicle } from '../town/fallback-vehicles'
import type { MoverKind, Trip } from '../town/town-trips'
import type { CitizenFigure } from './figure-parts'
import { citizenFigures } from './figures'

export interface MoverGroup {
  key: string
  kind: MoverKind
  themeId: string
  figure: number
  // Indices into the town's trips: one instance each, in this order.
  members: number[]
}

// The movers that share a figure, and so one instanced draw.
export function moverKinds(trips: readonly Trip[]): MoverGroup[] {
  const groups = new Map<string, MoverGroup>()
  trips.forEach(({ kind, themeId, figure }, index) => {
    const key = `${kind}:${themeId}:${figure}`
    const group = groups.get(key) ?? { key, kind, themeId, figure, members: [] }
    group.members.push(index)
    groups.set(key, group)
  })
  return [...groups.values()]
}

// What a kind of mover looks like in a theme: the theme's own town when it has drawn one, and
// until then the registry's townsfolk and a plain vehicle in the theme's palette.
export function moverFigure(
  { kind, figure }: Pick<MoverGroup, 'kind' | 'figure'>,
  theme: OfficeTheme
): CitizenFigure {
  if (kind === 'citizen') {
    const own = theme.town?.citizens ?? []
    const figures = own.length > 0 ? own : citizenFigures(theme.id)
    return figures[figure % figures.length]
  }
  const own = (theme.town?.vehicles ?? []).filter((vehicle) => vehicle.role === kind)
  return own.length > 0 ? own[figure % own.length] : fallbackVehicle(kind, theme.palette)
}
