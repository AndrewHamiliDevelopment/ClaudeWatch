import { describe, expect, it } from 'vitest'
import { MOVER_FLOORS, isOn, lapOf, poseAfter, townOn } from './movers.test-utils'
import { MAP_ROTATIONS, boxesOf, plainSightShare } from './sightline.test-utils'
import { gatePlaza } from './town-graph'
import { ROAD_WIDTH_M } from './town-grid'
import { townTrips } from './town-trips'

// The owner's complaint was "I don't see any citizens": these are the numbers that answer it.
const PLAIN_SIGHT_SHARE = 0.7
const PROMENADE_SHARE = 0.6
const SAMPLE_TIMES_SEC = [0, 60, 240]

describe.each(MOVER_FLOORS)('citizens on %s', (_name, floor) => {
  const town = townOn(floor)
  const citizens = townTrips(town).filter((trip) => trip.kind === 'citizen')
  // Every lot as tall as the plan lets it grow.
  const boxes = boxesOf(town.plan.lots)

  describe.each(MAP_ROTATIONS.map((azimuth, quarter) => [quarter, azimuth] as const))(
    'at map rotation %i',
    (_quarter, azimuth) => {
      it.each(SAMPLE_TIMES_SEC)('are in plain sight %i seconds in', (sec) => {
        const outdoors = citizens
          .map((citizen) => poseAfter(citizen, sec))
          .filter((pose) => !pose.isIndoors)
        // Most of the town is out walking, not waiting indoors.
        expect(outdoors.length).toBeGreaterThan(citizens.length / 2)
        expect(plainSightShare(outdoors, boxes, azimuth)).toBeGreaterThanOrEqual(PLAIN_SIGHT_SHARE)
      })
    }
  )

  it('walk most of every route on a promenade, in a park or on the plaza', () => {
    const plaza = {
      ...gatePlaza(town.plan.claim),
      width: ROAD_WIDTH_M.boulevard,
      depth: ROAD_WIDTH_M.avenue
    }
    const open = [...town.plan.promenades, plaza]
    for (const citizen of citizens) {
      const lap = lapOf(citizen)
      const inTheOpen = lap.filter((pose) => open.some((rect) => isOn(rect, pose)))
      expect(inTheOpen.length / lap.length).toBeGreaterThanOrEqual(PROMENADE_SHARE)
    }
  })

  it('start out of doors, so a still town has its people in it', () => {
    for (const citizen of citizens) expect(poseAfter(citizen, 0).isIndoors).toBe(false)
  })
})
