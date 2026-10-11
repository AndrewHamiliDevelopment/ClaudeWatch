import type { WallSegment } from '../logic/room-layout'
import type { InstancePlacement } from '../scene/instancing'

export function shojiParts(segment: WallSegment, height: number) {
  const yaw = segment.normalZ === 0 ? Math.PI / 2 : 0
  const place = (across: number, y: number): InstancePlacement => ({
    x: segment.x + Math.cos(yaw) * across,
    y,
    z: segment.z - Math.sin(yaw) * across,
    rotationY: yaw
  })
  const bars: InstancePlacement[] = []
  const count = Math.ceil(segment.length / 0.5)
  for (let bar = 0; bar <= count; bar++) {
    bars.push({
      ...place(-segment.length / 2 + (bar * segment.length) / count, height / 2),
      scaleY: height
    })
  }
  for (const y of [0, height / 2, height]) {
    bars.push({ ...place(0, y), scaleX: segment.length / 0.035, scaleY: 0.035 })
  }
  return {
    panel: { ...place(0, height / 2), scaleX: segment.length, scaleY: height },
    bars,
    pipe: { ...place(0, height + 0.08), scaleX: segment.length },
    dial: place(0, height + 0.14)
  }
}
