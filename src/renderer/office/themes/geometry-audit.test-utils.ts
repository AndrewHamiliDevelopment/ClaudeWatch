import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry
} from 'three'
export function makeGeometry(kind: string, args: readonly (number | undefined)[]): BufferGeometry {
  const [a, b, c, d, e, f] = args
  let geometry: BufferGeometry
  switch (kind) {
    case 'boxGeometry':
      geometry = new BoxGeometry(a, b, c)
      break
    case 'sphereGeometry':
      geometry = new SphereGeometry(a, b, c)
      break
    case 'cylinderGeometry':
      geometry = new CylinderGeometry(a, b, c, d)
      break
    case 'capsuleGeometry':
      geometry = new CapsuleGeometry(a, b, c, d)
      break
    case 'torusGeometry':
      geometry = new TorusGeometry(a, b, c, d, e)
      break
    case 'coneGeometry':
      geometry = new ConeGeometry(a, b, c)
      break
    case 'icosahedronGeometry':
      geometry = new IcosahedronGeometry(a, b)
      break
    case 'planeGeometry':
      geometry = new PlaneGeometry(a, b)
      break
    case 'ringGeometry':
      geometry = new RingGeometry(a, b, c, d, e, f)
      break
    default:
      throw new Error(`Uncounted geometry: ${kind}`)
  }
  return geometry
}
