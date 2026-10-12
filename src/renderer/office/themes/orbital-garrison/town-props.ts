import type { ZoneProp } from '../../town/town-dress'
import { box, sphere, SIDES, type PartSpec } from '../parts'
import { GARRISON } from './palette'
import { GARRISON_LOOKS } from './town-looks'
import { PROP_FOOTPRINT_M, PROPS } from './yard-props'

// A yard prop is drawn to a height limit with a share for its proportions: these give its
// natural size, with room for the tallest mast.
const NATURAL = { limit: 2.4, share: 0.4 }

function prop(name: string, zones: ZoneProp['zones'], parts: readonly PartSpec[]): ZoneProp {
  const top = Math.max(...parts.map((part) => part.at[1] + part.size[1] / 2))
  return { name, zones, size: [PROP_FOOTPRINT_M.length, top, PROP_FOOTPRINT_M.reach], parts }
}

function fromYard(id: string, zones: ZoneProp['zones']): ZoneProp {
  const yard = PROPS.find((each) => each.id === id)
  if (!yard) throw new Error(`The garrison yard has no prop called ${id}`)
  return prop(id, zones, yard.build(NATURAL.limit, NATURAL.share))
}

// Two benches end to end.
const BENCHES: PartSpec[] = SIDES.flatMap((side) => [
  box([side * 0.4, 0.4, 0], [0.7, 0.06, 0.4], GARRISON.steel),
  box([side * 0.4, 0.62, -0.18], [0.7, 0.3, 0.05], GARRISON.steel),
  ...SIDES.map((end) => box([side * 0.4 + end * 0.3, 0.19, 0], [0.06, 0.38, 0.36], GARRISON.hull))
])

// A trough of soil with three clipped shrubs in it.
const PLANTER: PartSpec[] = [
  box([0, 0.15, 0], [1.5, 0.3, 0.6], GARRISON.gunmetal),
  box([0, 0.31, 0], [1.4, 0.04, 0.5], GARRISON.umber),
  ...[-0.48, 0, 0.48].map((x) =>
    sphere([x, 0.52, 0], [0.44, 0.44, 0.44], GARRISON_LOOKS.park.accent)
  )
]

export const GARRISON_PROPS: readonly ZoneProp[] = [
  fromYard('container', ['workshop', 'market']),
  fromYard('landing-lights', ['civic', 'workshop']),
  fromYard('antenna-mast', ['civic']),
  fromYard('loader', ['workshop', 'market']),
  fromYard('barrier', ['civic', 'entertainment']),
  fromYard('floodlight', ['entertainment', 'workshop']),
  fromYard('fuel-drums', ['workshop']),
  fromYard('crate-stack', ['market', 'residential']),
  prop('bench-pair', ['park', 'entertainment', 'residential'], BENCHES),
  prop('planter-trough', ['park', 'residential', 'market'], PLANTER)
]
