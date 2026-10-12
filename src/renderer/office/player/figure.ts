import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  RingGeometry,
  SphereGeometry
} from 'three'
import type { ThemePalette } from '../themes/types'

interface FigurePart {
  geometry: BufferGeometry
  color: string
}

const FLAT = -Math.PI / 2
// Where the pointer over the player's head hangs: clear of the hat, which tops out at 1.6 m.
export const MARKER_Y = 2.3

// A traveller in a cloak and a wide hat, a lantern held out ahead (+z), on a ring of light.
// No agent looks like this: they are machines at desks.
function figureParts(palette: ThemePalette): FigurePart[] {
  return [
    {
      geometry: new RingGeometry(0.5, 0.68, 28).rotateX(FLAT).translate(0, 0.12, 0),
      color: palette.glow
    },
    { geometry: new ConeGeometry(0.36, 1.1, 10).translate(0, 0.55, 0), color: palette.lacquer },
    {
      geometry: new CylinderGeometry(0.17, 0.24, 0.14, 10).translate(0, 1.0, 0),
      color: palette.gold
    },
    { geometry: new SphereGeometry(0.17, 10, 8).translate(0, 1.2, 0), color: palette.paper },
    {
      geometry: new CylinderGeometry(0.36, 0.38, 0.05, 14).translate(0, 1.33, 0),
      color: palette.ink
    },
    { geometry: new ConeGeometry(0.2, 0.26, 10).translate(0, 1.48, 0), color: palette.ink },
    {
      geometry: new BoxGeometry(0.05, 0.05, 0.34).translate(0.24, 0.78, 0.17),
      color: palette.wood
    },
    { geometry: new SphereGeometry(0.09, 8, 6).translate(0.24, 0.7, 0.36), color: palette.glow },
    // A pointer hanging over its head: among a town's worth of buildings it is found at a glance.
    {
      geometry: new ConeGeometry(0.26, 0.5, 4).rotateX(Math.PI).translate(0, MARKER_Y, 0),
      color: palette.glow
    }
  ]
}

// Every part in one buffer, coloured per vertex: the whole player costs one draw.
export function playerGeometry(palette: ThemePalette): BufferGeometry {
  const parts = figureParts(palette).map(({ geometry, color }) => {
    const flat = geometry.toNonIndexed()
    geometry.dispose()
    return { flat, color: new Color(color), count: flat.getAttribute('position').count }
  })
  const total = parts.reduce((sum, part) => sum + part.count, 0)
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const colors = new Float32Array(total * 3)
  let offset = 0
  for (const { flat, color, count } of parts) {
    positions.set(flat.getAttribute('position').array, offset * 3)
    normals.set(flat.getAttribute('normal').array, offset * 3)
    for (let vertex = 0; vertex < count; vertex++) color.toArray(colors, (offset + vertex) * 3)
    offset += count
    flat.dispose()
  }
  const merged = new BufferGeometry()
  merged.setAttribute('position', new BufferAttribute(positions, 3))
  merged.setAttribute('normal', new BufferAttribute(normals, 3))
  merged.setAttribute('color', new BufferAttribute(colors, 3))
  return merged
}
