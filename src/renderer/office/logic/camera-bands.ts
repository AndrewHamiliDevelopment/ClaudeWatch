export type ZoomBand = 'desk' | 'floor' | 'building'
export type ZoomDirection = 'in' | 'out'

const BANDS_NEAR_TO_FAR: readonly ZoomBand[] = ['desk', 'floor', 'building']

// Orthographic zoom in screen pixels per metre for each band.
export const BAND_ZOOM: Record<ZoomBand, number> = { desk: 90, floor: 34, building: 8 }

const DEG_TO_RAD = Math.PI / 180
export const ISO_ELEVATION_DEG = 35
// camera-controls measures polar angle from straight up.
export const ISO_POLAR = (90 - ISO_ELEVATION_DEG) * DEG_TO_RAD
export const ISO_START_AZIMUTH = 45 * DEG_TO_RAD
const SNAP_STEP = 90 * DEG_TO_RAD
const SNAP_EPSILON = 1e-6

export function stepBand(band: ZoomBand, direction: ZoomDirection): ZoomBand {
  const index = BANDS_NEAR_TO_FAR.indexOf(band) + (direction === 'out' ? 1 : -1)
  return BANDS_NEAR_TO_FAR[Math.min(Math.max(index, 0), BANDS_NEAR_TO_FAR.length - 1)]
}

// Zoom is multiplicative, so "nearest" is measured on a log scale.
export function bandForZoom(zoom: number): ZoomBand {
  const distance = (band: ZoomBand): number => Math.abs(Math.log(BAND_ZOOM[band] / zoom))
  return BANDS_NEAR_TO_FAR.reduce((best, band) => (distance(band) < distance(best) ? band : best))
}

// The four isometric corners sit at 45° + k·90°.
export function snapAzimuth(azimuth: number, direction: -1 | 1): number {
  const steps = (azimuth - ISO_START_AZIMUTH) / SNAP_STEP
  const target =
    direction > 0 ? Math.floor(steps + SNAP_EPSILON) + 1 : Math.ceil(steps - SNAP_EPSILON) - 1
  return ISO_START_AZIMUTH + target * SNAP_STEP
}

// Trackpads fire dozens of wheel events per swipe; one swipe should move one band.
export function createWheelStepper(options: {
  threshold: number
  cooldownMs: number
}): (deltaY: number, nowMs: number) => ZoomDirection | null {
  let accumulated = 0
  let lockedUntilMs = -Infinity
  return (deltaY, nowMs) => {
    if (nowMs < lockedUntilMs) return null
    accumulated += deltaY
    if (Math.abs(accumulated) < options.threshold) return null
    const direction: ZoomDirection = accumulated > 0 ? 'out' : 'in'
    accumulated = 0
    lockedUntilMs = nowMs + options.cooldownMs
    return direction
  }
}

export function buildingFraming(
  floor: { width: number; depth: number },
  floorCount: number,
  viewport: { width: number; height: number }
) {
  // World props reach 12 m beyond either side, 19 m north and 7 m south of the plate.
  const width = floor.width + 24
  const depth = floor.depth + 26
  const height = Math.max(8, floorCount * 2.2 + 1)
  const projectedWidth = (width + depth) / Math.SQRT2
  const projectedHeight = projectedWidth * Math.cos(ISO_POLAR) + height * Math.sin(ISO_POLAR)
  return {
    target: [0, height / 2, -6] as [number, number, number],
    projectedWidth,
    projectedHeight,
    zoom: Math.max(
      0.1,
      Math.min(
        BAND_ZOOM.building,
        viewport.width / (projectedWidth * 1.2),
        viewport.height / (projectedHeight * 1.2)
      )
    )
  }
}
