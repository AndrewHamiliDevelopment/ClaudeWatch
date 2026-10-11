import { COURT } from './palette'
import { box, turned, type PartSpec, SIDES } from '../parts'
import type { FrameKind } from './roster'

interface FrameLivery {
  armor: string
  joint: string
  trim: string
}

const LIVERY: Record<FrameKind, FrameLivery> = {
  command: { armor: COURT.ink, joint: COURT.slate, trim: COURT.gold },
  vanguard: { armor: COURT.crimson, joint: COURT.ink, trim: COURT.gold },
  lancer: { armor: COURT.ivory, joint: COURT.slate, trim: COURT.gold }
}

const ARM_X = 0.38

// One forearm and fist.
const forearm = (side: number, { armor, joint }: FrameLivery): PartSpec[] => [
  box([side * ARM_X, 1.1, 0], [0.14, 0.34, 0.16], armor),
  box([side * ARM_X, 0.89, 0], [0.1, 0.1, 0.12], joint)
]

// The slim knight every frame shares, standing parked: feet at y 0, facing +z, about 2 m tall.
function knight(livery: FrameLivery): PartSpec[] {
  const { armor, joint, trim } = livery
  return [
    ...SIDES.flatMap((side) => [
      box([side * 0.2, 0.06, 0.04], [0.2, 0.12, 0.36], armor),
      box([side * 0.2, 0.4, 0], [0.15, 0.56, 0.18], armor),
      box([side * 0.2, 0.7, 0.02], [0.19, 0.12, 0.22], trim),
      box([side * 0.18, 0.95, 0], [0.13, 0.4, 0.15], joint),
      box([side * ARM_X, 1.42, 0], [0.11, 0.34, 0.12], joint)
    ]),
    box([0, 1.16, 0], [0.42, 0.14, 0.22], armor),
    box([0, 1.3, 0], [0.2, 0.18, 0.16], joint),
    box([0, 1.55, 0], [0.5, 0.34, 0.3], armor),
    box([0, 1.58, 0.16], [0.26, 0.2, 0.06], trim),
    box([0, 1.87, 0.02], [0.2, 0.2, 0.22], armor),
    { ...box([0, 1.88, 0.135], [0.16, 0.04, 0.02], COURT.lumen), glow: true }
  ]
}

const shoulders = (size: PartSpec['size'], color: string): PartSpec[] =>
  SIDES.map((side) => box([side * ARM_X, 1.7, 0], size, color))

const crest = (x: number, height: number): PartSpec => ({
  shape: 'cone',
  at: [x, 1.97 + height / 2, 0.02],
  size: [0.07, height, 0.07],
  color: COURT.gold
})

const EXTRAS: Record<FrameKind, (livery: FrameLivery) => PartSpec[]> = {
  // Broad stacked shoulder plates, a three-point crown and a long mantle.
  command: (livery) => [
    ...SIDES.flatMap((side) => forearm(side, livery)),
    ...shoulders([0.36, 0.1, 0.44], COURT.violet),
    ...SIDES.map((side) => box([side * 0.42, 1.8, 0], [0.26, 0.07, 0.36], COURT.gold)),
    box([0, 1.15, -0.19], [0.6, 1.1, 0.04], COURT.violet),
    crest(-0.07, 0.14),
    crest(0, 0.22),
    crest(0.07, 0.14)
  ],
  // Matched arms, each carrying a short blade along the forearm, and a swept head fin.
  vanguard: (livery) => [
    ...SIDES.flatMap((side) => [
      ...forearm(side, livery),
      box([side * 0.5, 1.02, 0.1], [0.03, 0.46, 0.12], COURT.marble),
      box([side * 0.5, 1.26, 0.1], [0.05, 0.06, 0.16], COURT.gold)
    ]),
    ...shoulders([0.24, 0.16, 0.3], livery.armor),
    turned(box([0, 2.02, -0.04], [0.05, 0.08, 0.3], COURT.gold), [0.5, 0, 0])
  ],
  // A grounded lance taller than the frame, and a short riding mantle.
  lancer: (livery) => [
    ...SIDES.flatMap((side) => forearm(side, livery)),
    ...shoulders([0.22, 0.2, 0.26], livery.armor),
    box([0, 1.4, -0.19], [0.44, 0.6, 0.04], COURT.marble),
    { shape: 'cylinder', at: [0.56, 1.05, 0.1], size: [0.05, 2.1, 0.05], color: COURT.gold },
    { shape: 'cone', at: [0.56, 2.3, 0.1], size: [0.13, 0.4, 0.13], color: COURT.ivory },
    crest(0, 0.26)
  ]
}

export function frameParts(kind: FrameKind): PartSpec[] {
  return [...knight(LIVERY[kind]), ...EXTRAS[kind](LIVERY[kind])]
}
