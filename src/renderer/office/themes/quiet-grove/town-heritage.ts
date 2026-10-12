import type { ZoneDesign, ZonePlot } from '../../town/town-dress'
import { heritageDesigns, type Restyle } from '../heritage'
import { box, sphere, type PartSpec } from '../parts'
import { GROVE_BUILDINGS } from './grove-buildings'
import { GROVE } from './palette'

const isMoss = (part: PartSpec): boolean => part.color === GROVE.moss
// The grove's roofs are slabs laid to a pitch; nothing else in its buildings is a turned box.
const isPitched = (part: PartSpec): boolean => part.shape === 'box' && part.rotation !== undefined

const CRATES = [-0.26, 0, 0.26]

// A stall along the greenhouse's front: an awning over crates of what grew inside.
function stallFront({ width, depth, height, accent }: ZonePlot): PartSpec[] {
  return [
    box([0, height * 0.56, depth * 0.43], [width * 0.8, 0.08, depth * 0.12], accent),
    ...CRATES.flatMap((spot, index) => [
      box([spot * width, 0.24, depth * 0.43], [width * 0.18, 0.24, 0.36], GROVE.timber),
      sphere(
        [spot * width, 0.42, depth * 0.43],
        [width * 0.14, 0.24, 0.3],
        index % 2 ? GROVE.fern : GROVE.clay
      )
    ])
  ]
}

const RESTYLES: Record<string, Restyle | undefined> = {
  // Its banks reach 2 cm past a 4 m plot of the campus green at full size.
  pond: { zones: ['park'], isRoof: isMoss, share: 0.92 },
  'rock-garden': { zones: ['park'], isRoof: isMoss },
  cabin: { zones: ['residential'], isRoof: isPitched },
  greenhouse: { name: 'greenhouse-stall', zones: ['market'], extra: stallFront },
  // Taller than a mill was built: the wheel grows with it, and marks the yards from afar.
  mill: {
    name: 'watermill',
    zones: ['workshop'],
    isRoof: isPitched,
    height: { min: 3, max: 9 },
    isLandmark: true
  },
  watchtower: {
    zones: ['civic'],
    isRoof: (part) => part.shape === 'box' && part.color === GROVE.bark,
    isLandmark: true
  },
  'pine-stand': { zones: ['park'], isRoof: (part) => part.color === GROVE.pine },
  // A park stays low for its walkers, so here the great tree is a broad old one.
  'great-tree': { zones: ['park'], isRoof: isMoss, height: { min: 4.4, max: 24 } }
}

export const GROVE_HERITAGE: readonly ZoneDesign[] = heritageDesigns(GROVE_BUILDINGS, RESTYLES)
