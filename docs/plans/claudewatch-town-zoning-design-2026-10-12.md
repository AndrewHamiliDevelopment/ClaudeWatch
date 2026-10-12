# ClaudeWatch Office: a zoned town on graph paper (LW-14 design)

Read from `/Users/angeloumali/Desktop/Work/ZKidz/ClaudeWatch` on `feature/prerelease-batch`, 2026-10-12. Nothing in the repo was edited. Nothing here was run: every number below is read from source or derived from it, and each claim about draws, visibility and rebuild cost is marked as needing its test.

One constraint in the brief is bent, on purpose, and needs the dispatcher's yes: the town is a function of the floor and of the campus rectangle it last held (section 2.4), not of the floor alone. It is still the same town on every start. Without that, one desk column coming and going moves a line of buildings 5 times in 12.

| Ticket                      | Status                                                | Source link                                          | Conversation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| none — needs filing (LW-14) | Designed, not built; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "I don't see any citizens. There are no citizens walking in the map. We can have the same size as what we have on the agents and then we can just enlarge our current agents. Also we need to properly implement the town structure. We need to have zoning in the structure so it doesn't look like it's random. It needs to be designed in a city skylines design so we have zoning: entertainment zone, working zone, residential zone, and so on. I want you to deeply research how we can implement this. Make sure the citizens are visible. We can also implement vehicles based on the theme." |

## Research basis

What the outside research found, and what this design takes from it. Sources are listed with each point.

| Finding                                                                                                                                                                         | Taken into the design as                                                                                                                                  | Source                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cities: Skylines zones are painted on cells along a road's frontage, up to four cells deep, and buildings grow to fill them; one zone per stretch of road                       | Zones are per block, every lot fronts a road, and a zone border always lies on a road                                                                     | https://skylines.paradoxwikis.com/Zoning                                                                                                                                             |
| Its roads form a hierarchy (highway, arterial, collector, local) with different widths, and highways take no frontage                                                           | An avenue from the gate, a boulevard round the campus, collectors on the block lines and footpaths between                                                | https://skylines.paradoxwikis.com/Roads · https://en.wikipedia.org/wiki/Road_hierarchy                                                                                               |
| Leisure and tourism districts are noisy and are kept away from housing; industry is buffered from housing                                                                       | Entertainment sits on the gate side away from the residential flank; workshops are on the opposite flank from housing                                     | https://skylines.paradoxwikis.com/Commercial_specialization                                                                                                                          |
| Parks have a radius of effect and are spread through housing                                                                                                                    | One block in eight outside the civic and market blocks becomes a park, and the belt round the campus is green                                             | https://skylines.paradoxwikis.com/Parks                                                                                                                                              |
| Sector model: uses extend outward in wedges along transport routes                                                                                                              | Zones are assigned by compass sector from the gate                                                                                                        | https://en.wikipedia.org/wiki/Sector_model                                                                                                                                           |
| Garden city: a green centre, radial boulevards, industry on the outer ring                                                                                                      | The campus keeps a planted belt inside a boulevard, and workshops sit furthest from the gate                                                              | https://en.wikisource.org/wiki/Garden_Cities_of_To-morrow/Chapter_1                                                                                                                  |
| Japanese castle town: the main road passes the castle's front, merchants line it, temples sit at the rim                                                                        | The market lines the avenue from the gate plaza; civic landmarks stand at the plaza                                                                       | https://en.wikipedia.org/wiki/J%C5%8Dkamachi                                                                                                                                         |
| Template and grid road layouts are cheap and stable; grown road networks (L-systems, tensor fields) reshape under a small change of input; Voronoi districts give oblique edges | A fixed lattice pinned at the gate, with zones by rule, and nothing grown                                                                                 | http://www.citygen.net/files/Procedural_City_Generation_Survey.pdf · https://www.tmwhere.com/city_generation.html · https://www.sci.utah.edu/~chengu/street_sig08/street_project.htm |
| Lots are cut with a frontage rule and a minimum size                                                                                                                            | One lot per 12 m cell, set back from whatever road stands on each side                                                                                    | https://martindevans.me/game-development/2015/12/27/Procedural-Generation-For-Dummies-Lots/                                                                                          |
| Small dioramas read when large shapes are predictable and colour carries the code                                                                                               | Each zone has one ground tint and one roof colour in the theme's own palette                                                                              | https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making · https://simcity.fandom.com/wiki/Zone                                            |
| City-builder citizens have a home and somewhere to go, and goods move by truck from industry to shops                                                                           | Citizens live in residential lots and walk to the market, the entertainment quarter, a park or the gate plaza; freight runs from a workshop to the market | https://skylines.paradoxwikis.com/Citizens · https://skylines.paradoxwikis.com/Traffic                                                                                               |

Not found: published ratios for how much to enlarge characters and vehicles in isometric games. The sizes in 4.4 are this design's own, checked against how an agent sits at its desk.

## Decisions taken on this design (2026-10-12)

- ASSUMPTION: the town may keep one stored rectangle (the held claim, section 2.4) — chose this because without it one agent arriving and leaving moves a row of buildings back and forth, which is exactly the randomness the owner objected to.
- ASSUMPTION: agents stay at 1.65, subagents go to 1.4, citizens and vehicles are 1.3, and desks and lounges grow by 1.27 to fit — chose this because the owner asked for citizens at the agents' size and the agents enlarged.
- ASSUMPTION: the town's entertainment quarter is for citizens; finished agents keep going to their company's lounge — chose this because moving agents into town changes the seating a working agent must not be disturbed by. It stays on the later list.
- ASSUMPTION: the two original themes' dress is built by Codex, as their agent looks were — chose this because that slice touches no file another builder touches.

## 0. What the code does today, and why it reads as random

| Finding                                                                                                                                                                                                | Where                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Every company has its own lot grid, starting at that company's centre, and each lot is jittered inside its 9 m cell. Grids of neighbouring companies do not line up.                                   | `themes/surroundings.ts:170-188` (`anchor.x + column * BLOCK_M + (draw - 0.5) * ...`)                      |
| A company's centre is `left + width / 2`, so one more desk column (5 m) moves the centre 2.5 m and every one of its lots with it; every company east of it in the row slides 5 m with all of its lots. | `src/office/sim/allocation.ts:108-110`, `src/office/sim/rooms.ts:72` (`DESK_PITCH = 5`)                    |
| The apron's lots are spread evenly along the plate's edges, so any change of plate size moves all of them.                                                                                             | `themes/apron.ts:64-68` (`centres(from, to, pitch)`)                                                       |
| Streets are whatever is left over: paving 2 m round each building, joined. There is no network, no hierarchy and no frontage.                                                                          | `logic/streets.ts:143-163`                                                                                 |
| A lot has no zone in the planning sense. `zoneId` is the owning company. A theme picks any design by seed and height.                                                                                  | `themes/surroundings.ts:30`, `themes/lot-kit.ts:64-80`, `themes/lot-parts.ts:26-30`                        |
| Three parallel design systems do the same job: `LotDesign` (Edo, Brass), `BuildingDesign` and `LotKit` (Court, Grove), `YardDesign` (Garrison).                                                        | `themes/lot-parts.ts:5`, `themes/lot-kit.ts:14`, `themes/orbital-garrison/lots.ts:29`                      |
| A design pick is `floor(draw * fitting.length)`, so when a lot's height limit crosses one design's minimum, the pick can jump to an unrelated design.                                                  | `themes/lot-parts.ts:26-30`, `themes/lot-kit.ts:60-67`                                                     |
| The height limit is continuous (`0.7 x gap to the nearest office`), so buildings near the campus change height whenever an office moves a metre, and the static batch is rebuilt.                      | `themes/surroundings.ts:121-124`, `scene/WorldView.tsx:104`                                                |
| Citizens walk a random out-and-back on the leftover paving, clipped to inside the ring road, on streets drawn in `palette.ink`.                                                                        | `citizens/routes.ts:43-64`, `citizens/street-grid.ts:85-106`, `scene/OfficeScene.tsx:144`                  |
| Colour is free and shape is a draw: the batch key is geometry plus surface with colour left out. There are four unit shapes.                                                                           | `scene/mesh-batches.ts:36-57`, `themes/unit-parts.tsx:6-10`                                                |
| The gate is the origin. Companies run east from x = 1.5 in two rows either side of z = 0. The plate's west edge is always -1.5; it grows east, north and south only.                                   | `src/office/sim/layout.ts:20-29`, `src/office/sim/allocation.ts:105-112`                                   |
| Agents are already drawn at 1.65 and subagents at 1.2; citizens at 1.3. Desks are modelled for a 1 m figure and are not scaled.                                                                        | `scene/Robot.tsx:15-16`, `citizens/figure-parts.ts:30`, `themes/EdoRoom.tsx:49`, `logic/room-layout.ts:24` |

FOUND: `citizens/figure-parts.ts` changed from `CITIZEN_SCALE = 0.92` to `1.3` between two reads in this session, so another builder is editing citizens now. Slice C below must start from that builder's merged result.

FOUND: "I don't see any citizens" is not reproduced. Three causes are plausible from the code (hidden behind buildings at 35 degrees, dark figures on ink streets, confined to a thin band), and none is measured. Slice C opens with the measurement.

## 1. The town plan as data

The town is graph paper pinned at the gate. The campus is a rectangle cut out of it, snapped to the 12 m lines. Nothing outside the cut ever moves.

```ascii
            x = -96        -24   0 = gate                  claim east      +48
              |  OLD TOWN   |    |      (grows east ->)        |    ring    |
   z = claim  +-------------+------------------------------------------------+
   north - 48 | RESIDENTIAL |  RESIDENTIAL  (north flank, K <= -1)           |
              |  K <= -2    |                                                |
   z = -24    +------+------+====================================+...........|
              |MARKET|CIVIC # boulevard 10 m, promenade inside   #           |
   z = 0  ====|=avenue=12m==#  green belt 3 to 21 m              #==East Rd==|
              |MARKET|CIVIC #   +----------------------------+   #           |
   z = +24    +------+------#   | plate: WORKING CENTRE      |   #           |
              | ENTERTAIN-  #   | companies, lounges, street |   #           |
              | MENT K >= 1 #   +----------------------------+   #           |
              |             +====================================+...........|
   claim      |             |  WORKSHOP  (south flank, K >= 0)               |
   south + 48 +-------------+------------------------------------------------+
     roads on every 24 m line (collector 6 m), footpaths on the 12 m lines between
```

### 1.1 Three nested lattices, one origin

All in metres, floor-local, origin at the gate (`FloorGeometry.elevator`, which the sim fixes at 0, 0).

```ts
// src/renderer/office/town/town-grid.ts
export const LOT_PITCH_M = 12 // one lot per cell
export const BLOCK_PITCH_M = 24 // a block is 2 x 2 lots; collectors run on these lines
export const GREEN_PITCH_M = 6 // park plots inside the claim
export const ROAD_WIDTH_M = { avenue: 12, boulevard: 10, collector: 6, lane: 2 } as const
export const SIDEWALK_M = { avenue: 1.5, boulevard: 1.5, collector: 1, lane: 0 } as const
export const AVENUE_MEDIAN_M = 3
// The boulevard (10) plus at least 3 m of green between it and the plate.
export const MIN_BELT_M = 13
// A held edge comes back in only once the campus needs this much less: more than one desk column.
export const CLAIM_RELEASE_M = 18
export const FAR_RING_FROM_M = 24
export const LOT_SIDE_MAX_M = 8
export const CLAIM_SETBACK_M = 1
export type DetailLevel = 'full' | 'balanced' | 'light'
export const RING_M: Record<DetailLevel, number> = { full: 48, balanced: 48, light: 24 }
export const OLD_TOWN_BLOCKS: Record<DetailLevel, number> = { full: 3, balanced: 3, light: 2 }
export const BUILDING_CAP: Record<DetailLevel, number> = { full: 200, balanced: 140, light: 90 }
```

`DetailLevel` is whatever Phase 12's `logic/quality.ts` exports; import it from there once it lands and delete this alias.

### 1.2 Types

```ts
// src/renderer/office/town/town-plan.ts
export type TownZone =
  | 'work'
  | 'civic'
  | 'market'
  | 'entertainment'
  | 'residential'
  | 'workshop'
  | 'park'
export type RoadClass = keyof typeof ROAD_WIDTH_M

export interface TownRoad {
  id: string // `road:x:${line}` | `road:z:${line}` | `boulevard:${side}` | 'avenue'
  class: RoadClass
  // Axis-aligned centre line.
  from: Point
  to: Point
  width: number
}

export interface TownBlock extends Rect {
  id: string // `block:${column}:${row}`
  column: number
  row: number
  zone: TownZone
}

// A Lot (themes/surroundings.ts) with a place in the plan. `zoneId` stays the owning company.
export interface TownLot extends Lot {
  zone: TownZone
  blockId: string
  facing: WallSide // from logic/room-layout
  frontage: RoadClass
  // On the kerb in front of it: where a trip starts and ends.
  door: Point
  isFarRing: boolean
  isLandmark: boolean
}

export interface RoadNode extends Point {
  id: number
}
export interface RoadEdge {
  from: number
  to: number
  class: RoadClass
  length: number
}
export interface RoadGraph {
  nodes: RoadNode[]
  edges: RoadEdge[]
}

export interface TownPlan {
  claim: Rect
  // The claim shrunk by MIN_BELT_M: it always contains the plate, and moves only when the claim does.
  envelope: Rect
  extent: Rect
  roads: TownRoad[]
  blocks: TownBlock[]
  lots: TownLot[]
  // Strips where a citizen must be seen: protected like offices by the height rule.
  promenades: Rect[]
  graph: RoadGraph
}

// The plate grown by MIN_BELT_M, not snapped: what the campus needs.
export function neededClaim(floor: FloorGeometry): Rect
// `held` is the claim of the last floor, or null on a first start. Pure.
export function campusClaim(needed: Rect, held: Rect | null): Rect
// Pure in (claim, detail). Memoised on `${west}:${east}:${north}:${south}:${detail}`.
export function townBlocks(claim: Rect, detail: DetailLevel): TownPlan
// Lot id to company zone id, for lots within FAR_RING_FROM_M of the claim. Absent: the floor's theme.
export function lotOwners(
  plan: TownPlan,
  companies: readonly ZoneGeometry[]
): ReadonlyMap<string, string>
// Park plots between the plate and the boulevard, and on bare plate. Runs on every floor change.
export function campusGreen(floor: FloorGeometry, plan: TownPlan): Lot[]
```

### 1.3 The algorithm

`campusClaim(neededClaim(floor), held)`:

1. `needed` is the floor's rect grown by `MIN_BELT_M` on every side.
2. With no held claim, snap each edge outward to a multiple of `LOT_PITCH_M`. The west edge comes out at -24 for every floor, because the plate's west edge is always -1.5.
3. With a held claim, each edge is settled on its own. It stays where it is held while the needed edge is inside it by less than `CLAIM_RELEASE_M`. Past the held edge, or inside it by 18 m or more, it is snapped afresh as in step 2.

`townBlocks(claim, detail)`:

1. `envelope = grow(claim, -MIN_BELT_M)`.
2. `extent`: west is `claim.west - OLD_TOWN_BLOCKS[detail] * 24`; the other three sides are the claim plus `RING_M[detail]`.
3. Roads. Collectors on every line `x = 24 I` and `z = 24 K` inside the extent and outside the claim. Lanes (footpaths, no vehicles) on the odd 12 m lines. The avenue is the `z = 0` line from the extent's west edge to the claim. The boulevard is four strips lying inside the claim, 10 m wide, against its edge. `z = 0` east of the claim stays a collector, so the campus street carries on to the horizon.
4. Cells. For every 12 m cell `(i, k)` in the extent and outside the claim, the block is `(floor(i / 2), floor(k / 2))`.
5. Zone of a block, from its column `I` and row `K` alone:

   | Where                                                                                | Zone                                                           |
   | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
   | `I = -2`, `K` in {-1, 0}                                                             | civic (the gate plaza's two blocks, either side of the avenue) |
   | `I <= -3`, `K` in {-1, 0}                                                            | market (avenue frontage)                                       |
   | `I <= -2`, `K >= 1`                                                                  | entertainment                                                  |
   | `I <= -2`, `K <= -2`                                                                 | residential                                                    |
   | `I >= -1`, `K <= -1`                                                                 | residential (the campus's north flank and north-east)          |
   | `I >= -1`, `K >= 0`                                                                  | workshop (the south flank and south-east)                      |
   | any of the above except civic and market, when `draw(hashOf('park:I:K'), 0) < 0.125` | park                                                           |
   | inside the claim                                                                     | work, with the belt dressed as park                            |

6. Lot rect. Start from the cell. Take off each side what stands there: 6 m for the avenue, 3 m for a collector, 1 m for a lane, `CLAIM_SETBACK_M` where the side is the claim's edge. Clamp each side to `LOT_SIDE_MAX_M`, held against the front. A typical lot is 8 x 8 m; an avenue lot is 8 x 5 m.
7. Facing. The side with the highest road class (avenue, boulevard, collector, lane). A tie goes to the side nearer the gate. `door` is the middle of that side, on the kerb.
8. Height. `maxHeight = min(24, ZONE_HEIGHT_CAP_M[zone], 0.7 * min(gapBetween(lot, envelope), gap to each promenade))`, with the existing `HEIGHT_PER_METRE`, `MAX_LOT_HEIGHT_M` and `gapBetween`. Under 2 m the lot becomes a `prop` lot; under 0.4 m it is dropped.

   ```ts
   export const ZONE_HEIGHT_CAP_M: Record<Exclude<TownZone, 'work'>, number> = {
     civic: 24,
     market: 7,
     entertainment: 12,
     residential: 9,
     workshop: 12,
     park: 5
   }
   ```

9. Promenades: the boulevard's inner 1.5 m sidewalk on all four sides, the avenue's 3 m median, and every park block's interior.
10. Identity. `id = lot:${i}:${k}`, `seed = hashOf(id)`. A landmark is the lot with the lowest seed in its zone whose height fits the theme's landmark design.
11. Cap. Over `BUILDING_CAP[detail]`, far-ring lots are dropped by seed (the existing `capped` rule). At `balanced` every other far-ring lot is dropped first. A dropped lot leaves its zone-coloured pad, which costs nothing.
12. Graph. A node at every crossing of two road lines, at each boulevard corner, and at the plaza in front of the gate. An edge per road stretch between two nodes.

### 1.4 Placement, separation and the lounges

- **How zones are placed.** A mix. Compass sectors from the gate decide the zone: west is the old town (civic at the gate, market along the avenue), south-west is entertainment, north is residential, south and east are workshops. Distance from the campus decides height and theme, never zone: low by the boulevard, tall in the far ring.
- **What separates them.** A zone border always lies on a collector, the avenue or the boulevard, because zones are per block. The working centre is separated from everything by the green belt and the boulevard.
- **Entertainment and the lounges.** Lounges stay where they are, inside each company's grounds (`src/office/sim/projects.ts:91-95`). The entertainment zone is the town's shared one, directly south-west of the gate plaza. It is the town district nearest the campus street that every company gateway opens on, so a later walk from any lounge is gateway, street, gate, plaza.
- **More than one theme.** Zone and lot never depend on theme. `lotOwners` gives each lot within 24 m of the claim to the nearest company (the existing tie rule, `themes/surroundings.ts:161-168`), and that company's theme dresses it. The old town and the far ring take the floor's theme. So each company has a neighbourhood two lots deep in its own dress, residential to the north and workshops to the south whatever the theme.

## 2. Stability under growth

### 2.1 Four anchoring strategies

| Strategy                                            | What it is anchored to                     | One desk column (5 m) arrives                                                                                   | The same column leaves again                                                                                                                   | Verdict                                                           |
| --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A. Company lattice (today's ring)                   | Each company's centre                      | All of that company's lots move 2.5 m; every company east of it moves 5 m with its lots; streets are re-derived | All of it moves back                                                                                                                           | Rejected: it is the cause of the random look and of the reshuffle |
| B. Plate edges (today's apron)                      | The plate's four edges, lots spread evenly | Every apron lot on the two affected sides moves                                                                 | All of it moves back                                                                                                                           | Rejected                                                          |
| C. Gate lattice, claim snapped from the floor alone | The gate, which the sim never moves        | Nothing, 7 times in 12; otherwise one line of cells                                                             | The line comes back: 5 times in 12 an agent coming and going moves a line of buildings and the boulevard, and rebuilds the town batch each way | Rejected: it flaps on the commonest event                         |
| D. Gate lattice, claim snapped and held             | The gate, and the claim of the last floor  | As C                                                                                                            | Nothing. An edge comes in only after the campus needs 18 m less                                                                                | Chosen                                                            |

D is chosen because the gate is the one point the sim holds still, snapping turns a continuous change into a rare and local one, and holding the edge stops that rare change from repeating.

### 2.2 Exactly what moves

| Event                              | Plate                                    | Town blocks (`townBlocks`)                                                                                                                                                                                                                                                                       | Belt (`campusGreen`)                                                                    |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| One desk column in the longer row  | East edge +5 m                           | Nothing, unless `plateEast + 13` passes the claim's east edge. Then the east boulevard steps 12 m, the one column of cells it covers is removed (one lot per claimed row), and lots within about 36 m of that side get a lower height limit. Every other lot keeps id, place, facing and design. | Plots under the slid companies' new footprints go; the same number reappear behind them |
| One desk column in the shorter row | Unchanged                                | Nothing                                                                                                                                                                                                                                                                                          | As above                                                                                |
| A new project                      | A company widens or deepens by 6 to 21 m | 0, 1 or 2 lines of cells on that side                                                                                                                                                                                                                                                            | As above                                                                                |
| A new company                      | East edge moves by its width plus 3 m    | That many 12 m columns removed on the east; the ring's outer edge extends by the same, adding new cells with new ids. Lots near it change owner, so they are re-dressed in place.                                                                                                                | New plots round it                                                                      |
| That column leaves again           | East edge -5 m                           | Nothing: the edge is held                                                                                                                                                                                                                                                                        | Reverse                                                                                 |
| A project or company leaves        | Shrinks by 6 m or more                   | Nothing until the campus needs 18 m less on that side. Then the edge is snapped afresh and the same cells come back with the same ids, seeds and designs                                                                                                                                         | Reverse                                                                                 |
| Anything, west of x = -24          | Never changes                            | The old town (civic, market, entertainment, north-west residential) never changes at all                                                                                                                                                                                                         | None                                                                                    |

A design changes on a surviving lot only when the lot's height limit drops below that design's minimum (see 3.2).

### 2.3 Lot identity

`lot:${i}:${k}` on the 12 m lattice and `green:${u}:${v}` on the 6 m lattice. Both are coordinates on paper pinned at the gate, so a lot is the same lot for as long as its cell is outside the claim. The on-plate props along company walls (`propCandidates`, `themes/surroundings.ts:210-244`) are campus furniture and keep their company-anchored ids.

### 2.4 The held claim

- **What is kept.** One rectangle: `{ version: 1, west, east, north, south }`, in metres, under the key `claudewatch.office.claim`, through `browserStorage` as `logic/office-themes.ts` keeps theme choices. It is read once when the scene mounts and written when the claim changes.
- **It is not a running maximum.** That is the trap already recorded for the saved layout. An edge is released once the campus needs 18 m less, so a campus that shrinks gets its town back. The test grows a floor by 40 m, shrinks it by 40 m and expects the first claim again.
- **What can flap now.** Only a swing of more than 6 m across a line: a whole project or company leaving and returning. A desk column (5 m) cannot.
- **What it costs.** The belt's green is 3 to 21 m wide instead of 3 to 15 m. It is planted, never bare.
- **Validation.** A stored value is accepted only if it has the four numbers, each a multiple of 12, and contains the needed claim. Anything else is treated as no held claim.
- **Determinism.** The town is a pure function of the floor and the held claim. A first start, a cleared store and the view-only page all give the town of the floor alone. Passing `null` for `held` everywhere gives strategy C, if the dispatcher will not have the stored rectangle.

## 3. The theme contract

### 3.1 What replaces what

| Today                                                                                | Becomes                                                                                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `kit.zone.Surroundings` (a component per theme)                                      | Data: `theme.town.designs`. One shared `TownView` draws every theme.                                           |
| `world.District`                                                                     | Deleted. The zoned blocks are the district.                                                                    |
| `world.Hangar`                                                                       | The theme's workshop landmark, a `ZoneDesign` with `isLandmark`.                                               |
| `world.Tower`                                                                        | Kept as it is, stood on the civic landmark lot instead of `towerStand`. Still drawn only in the building band. |
| The apron (`WORLD_APRON`, `apron.ts`, `town-apron.ts`, `TERRACE_APRON`, `PAD_APRON`) | The green belt: `campusGreen` plots dressed with each neighbouring company's park designs and props.           |
| `Streets` (one colour, one draw)                                                     | `TownGround`: roads, sidewalks, median, plaza and zone pads in one vertex-coloured mesh, one draw.             |
| `kit.zone.Ambient`, `kit.zone.Lounge`                                                | Unchanged.                                                                                                     |
| The citizen registry keyed by theme id (`citizens/figures.ts:62-73`)                 | `theme.town.citizens`.                                                                                         |

### 3.2 Types and the one picker

```ts
// src/renderer/office/town/town-dress.ts
export interface Plot {
  width: number
  depth: number
  height: number
  seed: number
  accent: string
}

export interface ZoneDesign {
  name: string
  zones: readonly Exclude<TownZone, 'work'>[]
  // Never picked for a lot lower than `min`.
  height: { min: number; max: number }
  // Origin at the lot's centre on the ground; the front faces +z.
  build: (plot: Plot) => PartSpec[]
  isLandmark?: true
}

export interface ZoneProp extends PropDesign {
  zones: readonly Exclude<TownZone, 'work'>[]
}
export interface ZoneLook {
  accent: string
  ground: string
}
export type VehicleRole = 'transit' | 'freight' | 'runabout'
export interface VehicleDesign {
  name: string
  role: VehicleRole
  parts: () => FigurePart[]
}

export interface TownDress {
  designs: readonly ZoneDesign[]
  props: readonly ZoneProp[]
  looks: Record<Exclude<TownZone, 'work'>, ZoneLook>
  roads: { carriageway: string; sidewalk: string; promenade: string }
  citizens: readonly CitizenFigure[]
  vehicles: readonly VehicleDesign[]
}

export function dressLot(lot: TownLot, base: number, dress: TownDress): PlacedGroup
```

`OfficeTheme` gains `town: TownDress`, loses `kit.zone.Surroundings`, and `world` shrinks to `{ Tower }`.

`dressLot`, in order:

1. Pool: the designs whose `zones` include `lot.zone` (the landmark designs when `lot.isLandmark`). An empty pool falls back to the residential designs, then to all, so a theme with a gap still fills every lot.
2. Order the pool by `hashOf(design.name) ^ lot.seed`. Take the first whose `height.min` fits. This is the fix for the jumping pick: a lot changes design only when its own design stops fitting.
3. Height is `min(room, min + (max - min) * draw(seed, 5))`.
4. Turn is the quarter turn that points +z at `lot.facing`, so fronts face the street.
5. `plot.accent` is `dress.looks[lot.zone].accent`. A design paints its roof or awning with it.

It replaces `placeLot` (`lot-kit.ts`), `lotContents` and `designFor` (`lot-parts.ts`) and `buildLot` (`orbital-garrison/lots.ts`). Garrison's `build(limit, share)` is wrapped as `(plot) => scaled(design.build(plot.height / s, draw(plot.seed, 7)), s)`.

### 3.3 How a zone reads at a glance, within the cost model

- **Ground.** Each block's pad is tinted with the floor theme's `looks[zone].ground`, in the one ground mesh. This is the zoning-view colour of a city builder, in the theme's own palette, and it is free.
- **Roofs.** Each design takes `plot.accent` for its roof parts, so every roof in a zone shares a colour. Colour is applied per instance, so this adds no draw (`scene/mesh-batches.ts:48-56`).
- **Skyline.** The zone height caps and the promenade rule give each zone a height band: the market is a low street, civic and the far ring are tall.
- **Shapes.** Designs may use the four unit shapes only. A new geometry is a new draw, and `themes/geometry-budget.test.ts` holds that line.
- **Street furniture.** No separate type. The plan emits `prop` lots on the avenue's median every 8 m and on the boulevard's inner verge every 10 m, carrying the zone of the block beside them. A theme's `props` tagged for that zone fill them.

### 3.4 What each theme has already, by zone

No new geometry is needed to light up every zone on day one. Gaps are filled by the fallback until the theme's builder adds a design.

| Zone          | Neo Edo Steam                 | Brass Workshop                                         | Violet Court                | Quiet Grove                               | Orbital Garrison                                   |
| ------------- | ----------------------------- | ------------------------------------------------------ | --------------------------- | ----------------------------------------- | -------------------------------------------------- |
| civic         | pagoda, watchtower (landmark) | clock tower (landmark)                                 | keep (landmark), bell-tower | watchtower (landmark)                     | control-tower (landmark), comms-tower, radar-tower |
| market        | tea stall, storehouse         | warehouse                                              | colonnade                   | greenhouse                                | new: commissary                                    |
| entertainment | bathhouse (landmark)          | new: music hall                                        | new: tilt yard              | new: spring pavilion                      | new: canteen dome                                  |
| residential   | townhouse                     | new: lodging row                                       | academy, new: manor         | cabin                                     | barracks                                           |
| workshop      | storehouse                    | foundry (landmark), boiler house, pipe yard, gasometer | frame-hangar                | mill                                      | hangar, tank-farm, frame-pad                       |
| park          | shrine garden                 | new: bandstand green                                   | parterre                    | pond, rock-garden, pine-stand, great-tree | new: hydroponic bed                                |

All names are the repo's own or new descriptive ones. Original looks only.

### 3.5 Batches and the draw budget

| Layer                    | Batch                     | Rebuilt when                                  | Draws (to be measured)                                          |
| ------------------------ | ------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Ground                   | one mesh                  | the claim steps, or the floor theme changes   | 1 (as `Streets` today)                                          |
| Town blocks, every theme | one static `BatchedScene` | the claim steps, a lot changes owner or theme | at most 8: four shapes, matte and glow                          |
| Belt and campus props    | one static `BatchedScene` | the plate or a company changes                | at most 8; takes the place of today's District and Hangar batch |
| Tower                    | `WorldView`, as today     | the zoom band changes                         | as today                                                        |
| Ambient                  | as today                  | as today                                      | as today                                                        |
| Citizens and vehicles    | instanced, one per kind   | kinds change                                  | 10 at full, 6 balanced, 3 light                                 |

Net against today: the District and Hangar batch goes, the belt batch comes, and vehicles add up to 4. The 300-draw ceiling for three themes and 60 agents must be confirmed by `themes/live-budget.test.tsx`; it is not confirmed here.

Cost on a floor change: `campusClaim` is four comparisons and at most four snaps. `townBlocks` is memoised on the claim, so it runs only when the claim steps (about 250 cells, a few rect tests each). `lotOwners` and `campusGreen` run every time over a few dozen rects.

## 4. Citizens and vehicles

### 4.1 Why they will be seen

1. **Protected strips.** Promenades go into the same height rule as offices, so nothing in town may hide the boulevard's inner sidewalk, the avenue's median or a park, at any of the four rotations. First-ring lots come out at most 6.6 m, avenue lots at most 3.1 m.
2. **Routes prefer them.** A pedestrian's path cost per metre is 1 on the avenue, the boulevard and in parks, 2 on a lane and 2.5 on a collector. On the avenue a pedestrian walks the median; on the boulevard, the inner sidewalk.
3. **Contrast.** Sidewalks and promenades are drawn in `roads.promenade`, a light colour, with the carriageway dark. Today everything a citizen walks on is `palette.ink`.
4. **Size.** See 4.4.
5. **A test that says so.** `sightline.test-utils.ts` has `isHidden(point, lots, azimuth)`: a ground point is hidden when a lot's box stands between it and the camera at 35 degrees. AC: at each of the four rotations, at three sampled times, at least 70% of citizens are in the open, and every route has at least 60% of its length on a promenade, a park or the plaza.

### 4.2 Trips

```ts
// src/renderer/office/town/town-trips.ts
export type MoverKind = 'citizen' | VehicleRole
export interface Trip {
  kind: MoverKind
  themeId: string
  figure: number
  route: CitizenRoute // citizens/route-pose.ts, with `isLoop` and `stops` added
  speed: number
}
export function townTrips(town: TownInput): Trip[]
```

1. **Homes.** Citizen `n` lives at a residential lot, picked by seed from the residential lots sorted by id. Its dress is the theme that owns that lot.
2. **Destination.** By seed: market 30%, entertainment 25%, park 20%, the gate plaza 15%, civic 10%. The lot is a seeded pick within that zone. A citizen stops at the plaza and never enters the plate.
3. **Path.** Dijkstra over `plan.graph` from the home's door to the destination's door with the costs above. The graph has a few hundred nodes.
4. **Route.** A closed loop: the path out, offset to its side of each road, then the path back, offset to the other. A stop of 8 to 20 s at the destination and 4 to 10 s at home. `routePose` gains a loop mode and stops; `walkedSec` and the hold for the player are unchanged.
5. **Vehicles.** `transit` loops the boulevard in the outer lane. `freight` runs a workshop lot to a market lot and back. `runabout` runs the avenue from the plaza to its west end. A vehicle keeps to the right-hand lane of travel and never uses a lane (footpath). Speeds 2.5 to 4 m/s; citizens stay at 0.6 to 1.2.
6. **Corners.** The lateral offset follows the smoothed heading `CitizenLayer` already keeps (`TURN_PER_SEC`), so a corner is an arc.

### 4.3 Vehicles per theme, and counts

| Theme            | transit (boulevard) | freight (workshop to market) | runabout (avenue) |
| ---------------- | ------------------- | ---------------------------- | ----------------- |
| Neo Edo Steam    | steam tram          | hand cart                    | lantern rickshaw  |
| Brass Workshop   | brass omnibus       | boiler lorry                 | pedal velocipede  |
| Violet Court     | banner coach        | supply wain                  | gilded carriage   |
| Quiet Grove      | pony trap           | timber wagon                 | garden barrow     |
| Orbital Garrison | patrol rover        | cargo hauler                 | hover sled        |

Transit and runabouts wear the floor's theme; freight wears the theme that owns its workshop lot. Each kind is one merged, vertex-coloured geometry and one instanced draw, built by the existing `citizenGeometry`.

| Detail   | Citizens | Vehicles | Citizen kinds | Vehicle kinds |
| -------- | -------- | -------- | ------------- | ------------- |
| full     | 48       | 12       | 6             | 4             |
| balanced | 28       | 6        | 4             | 2             |
| light    | 14       | 0        | 3             | 0             |

A smaller level sends out the first of the same movers on the same routes, as `citizenRoutes` does today.

### 4.4 Scale: citizens at the agents' old size, agents enlarged

| Figure   | Scale          | Height                 | Note                                                               |
| -------- | -------------- | ---------------------- | ------------------------------------------------------------------ |
| Agent    | 1.65           | 1.65 m                 | Already in `scene/Robot.tsx:15`. Keep.                             |
| Subagent | 1.4 (from 1.2) | 1.4 m                  | At 1.2 it is smaller than a citizen.                               |
| Citizen  | 1.3            | 1.3 m                  | The agents' size before. Already in `citizens/figure-parts.ts:30`. |
| Vehicle  | 1.3            | cart 1.2 to tram 2.4 m | Same factor as citizens.                                           |
| Player   | 1              | 1.6 m to the hat       | Unchanged; its pointer hangs at 2.3 m.                             |

All five go in one new file, `src/shared/office/figure-scale.ts` (the sim needs one of them), with `FURNITURE_SCALE = AGENT_SCALE / 1.3` (1.27): the factor by which agents grew.

How an agent sits (`src/office/sim/rooms.ts:127-189`): a 4 x 4 m room on a 5 m pitch, rows 6 m apart; the main seat 0.3 m south of the room's centre; two guest seats at 1.15 m either side and 0.95 m north; the desk drawn 0.62 m ahead of each seat (`DESK_REACH`), 1.2 to 1.3 m wide, its top at 0.44 to 0.62 m.

What must grow with the agents:

| Thing                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Where                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Desk and chair at every seat | Scaled by `FURNITURE_SCALE` about the seat, in one wrapper: `<group position={seat} scale={S}><group position={-seat}><kit.Desk/></group></group>`. No theme file changes. The picture at the desk is then the one at 1.3.                                                                                                                                                                                                                                               | `scene/FloorView.tsx:60-62`                                    |
| Guest and team desks         | Scaled by `SUBAGENT_SCALE / 1.3` (1.08), since a smaller figure sits there.                                                                                                                                                                                                                                                                                                                                                                                              | same                                                           |
| Guest seats                  | 1.15 m to 1.25 m either side, so the wider main figure clears the guest desks. Still inside the 4 m room.                                                                                                                                                                                                                                                                                                                                                                | `src/office/sim/rooms.ts:170-171`                              |
| The player's desk footprint  | `DESK_M` and the reach times `FURNITURE_SCALE`.                                                                                                                                                                                                                                                                                                                                                                                                                          | `player/walk-ground.ts:17, 73-77`                              |
| The lounge, whole            | Every length in the sim's lounge (width 6, seat pitch 1.25, first seat 1.125, row pitch 2, margins 3 and 2) is multiplied by `FURNITURE_SCALE`, so a lounge of four seats is 7.6 x 6.4 m. The scene wraps `kit.Lounge` in a group scaled by the same factor about the lounge's centre and hands the theme the lounge divided by it. The theme draws its lounge as it does today, and every stool lands on the sim's seat at the agents' new size. No theme file changes. | `src/office/sim/rooms.ts:52, 99-125`, `scene/FloorView.tsx:43` |

What does not grow: rooms, desk pitch, row pitch, walls (1.3 m: an agent's head now shows over them), doors (1.1 m), the name card height (2.45 m, clear of 1.65 m). A company's grounds widen only by what its lounge gains.

## 5. Build plan

Base branch for every builder: `feature/prerelease-batch` after the in-flight citizens, looks and performance slices are merged. Each builder works in its own worktree under `.claude/.worktree/`. Gate for every slice: `npx vitest run src/renderer/office src/office && npm run typecheck && npx eslint src/renderer/office`, plus the Electron fixture check.

```ascii
 Wave 1 (one builder)        Wave 2 (five in parallel)                Wave 3 (one)
 +--------------------+      +--------------------------------+       +-------------------+
 | A1 plan core, pure |--+-->| A2 Garrison dress              |--+    | Z old contract    |
 |  types, lattices,  |  |   +--------------------------------+  |    |  fields removed,  |
 |  zones, lots,      |  +-->| B ground, view, scale, wiring  |--+--->|  apron deleted,   |
 |  dressLot          |  |   +--------------------------------+  |    |  budgets, four    |
 +--------------------+  +-->| C trips, movers, sightline     |--+    |  rotations        |
                         |   +--------------------------------+  |    +-------------------+
                         +-->| D Edo and Brass dress          |--+
                         |   +--------------------------------+  |
                         +-->| E Court and Grove dress        |--+
                             +--------------------------------+
```

| Slice                 | Owner   | Files owned (exclusive)                                                                                                                                                                                                                                                                                                                                                                                                                  | Tests and acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Hours with Claude / without |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| A1 Plan core          | A       | new `town/town-grid.ts`, `town-claim.ts`, `town-zones.ts`, `town-roads.ts`, `town-lots.ts`, `town-plan.ts`, `town-dress.ts` and their tests; `themes/types.ts` (add `town`, old fields optional for now); `themes/surroundings.ts` (keep `Lot`, `heightLimit`, `officesOf`, `lotBase`, constants and the on-plate props as `campusProps`; delete the ring); `themes/lot-kit.ts`                                                          | Same floor, same plan. Every lot outside the claim, on no road, overlapping nothing. Zone borders lie on collectors. Height rule holds against offices and promenades. Growth table of 2.2 as tests: +5 m short of the edge changes no lot; past it changes one line of cells; the same 5 m back changes nothing; walking the plate east and back in 1 m steps over 40 m ends on the first claim, with the same ids. `dressLot` keeps a design until it stops fitting. | 2.25 / 10                   |
| A2 Garrison dress     | A       | `themes/orbital-garrison/**`                                                                                                                                                                                                                                                                                                                                                                                                             | Every zone has a design; the adapter builds each inside its plot at min and max height; unit shapes only.                                                                                                                                                                                                                                                                                                                                                              | 1 / 5                       |
| B Ground, view, scale | B       | new `town/town-ground.ts`, `TownGround.tsx`, `TownView.tsx`, `town/use-held-claim.ts`, `src/shared/office/figure-scale.ts` and tests; `scene/OfficeScene.tsx`, `scene/WorldView.tsx`, `scene/FloorView.tsx`, `scene/Robot.tsx` (constants only), `player/walk-ground.ts`, `player/PlayerLayer.tsx`, `src/office/sim/rooms.ts` and its test. Deletes `logic/streets.ts`, `player/Streets.tsx`, `player/district-lots.ts` and their tests. | Ground is one draw with a colour per zone. A claim that does not step gives an identical revision string, so no rebuild. The player never stands in a lot. A desk scaled about its seat keeps its seat's coordinates. Every lounge stool stands on a sim seat. Seated agents keep their rooms. A stored claim of the wrong shape is ignored.                                                                                                                           | 3 / 13                      |
| C Movers              | C       | new `town/town-trips.ts`, `town/sightline.test-utils.ts`, `town/citizens-visible.test.ts`; `citizens/route-pose.ts`, `citizens/town.ts`, `citizens/CitizenLayer.tsx` (becomes `MoverLayer.tsx`), `citizens/figure-parts.ts`. Deletes `citizens/routes.ts`, `citizens/street-grid.ts`. Reads citizens from `theme.town.citizens`, falling back to `citizenFigures` until Z.                                                               | First, the sightline measure on today's build: that is the `Validated:` line. Then: homes are residential lots; no mover inside a lot, the plate or a zone; the 70% and 60% rules of 4.1; vehicles never on a lane; mover draws within the table of 4.3; still under reduced motion.                                                                                                                                                                                   | 2.5 / 12                    |
| D Edo and Brass       | D       | `themes/EdoSurroundings.tsx`, `EdoDistrict.tsx`, `BrassSurroundings.tsx`, `Hangar.tsx`, `ParkedFrames.tsx`, `builtins.ts`, `BrassKit.tsx`, `citizens/figures-edo-brass.ts`                                                                                                                                                                                                                                                               | Designs tagged by zone, roofs take the accent, a landmark for civic and workshop, three vehicles each, citizens moved into `town`. Unit shapes only.                                                                                                                                                                                                                                                                                                                   | 2 / 10                      |
| E Court and Grove     | E       | `themes/violet-court/**`, `themes/quiet-grove/**`, `citizens/figures-court-garrison.ts` (Court half; A2 takes the Garrison figures into its folder)                                                                                                                                                                                                                                                                                      | As D.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 2 / 10                      |
| Z Close               | primary | `themes/types.ts` (remove `Surroundings`, `District`, `Hangar`), `citizens/figures.ts` (deleted once every theme carries its own citizens), `themes/apron.ts`, `town-apron.ts`, `lot-parts.ts`, `LotFill.tsx` (apron half), `WorldArchitecture.tsx` (`ApronPaving`), the old tests, `themes/live-budget.test*`, `themes/no-desk-hidden.test.tsx`                                                                                         | Three themes and 60 agents within 300 draws. No desk and no promenade hidden at four rotations. `dead-code-check.sh` clean. A screenshot at each rotation and at the widest zoom.                                                                                                                                                                                                                                                                                      | 1.5 / 5                     |

Total 14.25 h with Claude, 65 h without. Elapsed about 6 h with five builders.

**Deleted:** `logic/streets.ts`, `player/Streets.tsx`, `player/district-lots.ts`, `citizens/routes.ts`, `citizens/street-grid.ts`, `citizens/figures.ts`, `themes/apron.ts`, `themes/town-apron.ts`, `themes/lot-parts.ts`, `themes/orbital-garrison/apron.ts` and `lots.ts`, the ring half of `surroundings.ts`, the apron half of `LotFill.tsx`, `placeLot` in `lot-kit.ts`, every theme's `Surroundings`, `District` and `Hangar` component (their part lists live on as designs), and the tests of each.

**Must not be touched:** `scene/mesh-batches.ts`, `scene/BatchedScene.tsx`, `logic/frame-governor.ts`, `logic/quality.ts`, `scene/CameraRig.tsx`, `scene/Horizon.tsx`, `logic/office-themes.ts`, every roster, cast and character file, the HUD, the bridge, and all of `src/office/sim/` except the guest seats and the lounge lengths in `rooms.ts`. Builders D, E and A2 do not edit `town/**`, `themes/types.ts`, `themes/lot-kit.ts`, `themes/parts.tsx` or `themes/surroundings.ts`: a need there is reported as `FOUND:` to A. This is the trap already recorded for parallel theme builders.

### Riskiest parts

| Risk                                                                                                                                                  | How to de-risk                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The held claim goes wrong: it only ever grows, or a bad stored value survives.                                                                        | Designed out in 2.4 and held by A1's tests: the walk east and back ends on the first claim, and B's test rejects a stored value of the wrong shape.                                                                                                                                                       |
| The lounge grows by 1.27 and a company's grounds may widen with it, which slides the companies east of it once, on the first start after the upgrade. | The lounge is the last box in a company's grounds (`projects.ts:91-95`), so no project moves inside its company, and a seated agent moves with its desk when its office slides (LW-9). B's test builds the seeded floor before and after and expects every project's corner unchanged within its company. |
| Rebuilding the town batch when the claim steps (about 200 lots, 3,000 parts).                                                                         | B measures it with the Phase 12 profile script before D and E add designs. The belt is in its own batch so ordinary growth never rebuilds the town.                                                                                                                                                       |
| The second static batch repeats the eight shape draws and the ceiling is 300.                                                                         | B runs `live-budget` with a stand-in dress on day one. Fallback: put the belt in the town batch and round its heights to 0.5 m.                                                                                                                                                                           |
| Citizens still not seen, because the cause was never measured.                                                                                        | C measures first. If the count on screen is already fine and the cause is contrast or size, the trip work shrinks.                                                                                                                                                                                        |
| The promenade rule and the zone caps flatten the town.                                                                                                | A1 asserts the far ring's median height is at least twice the first ring's on the seeded floor; the caps are constants.                                                                                                                                                                                   |
| Three design systems folded into one change a look.                                                                                                   | `themes/world-designs.test.ts` already builds every design; extend it to every zone at min and max height. D and E compare a still before and after.                                                                                                                                                      |
| Other builders are in the same files now (`figure-parts.ts` changed during this read).                                                                | Wave 2 starts only from the merged branch; each builder is told its base commit.                                                                                                                                                                                                                          |

## 6. What to defer

The brief asks for this list. Each entry is a feature nobody has asked for yet. None is a defect found in this work: the two that were (threshold flapping and lounge furniture) are designed in above.

1. Agents walking to the entertainment zone when done. The owner asked for the zone, not for agents to use it, and it changes who sits where.
2. Curved or diagonal roads, water, bridges, terrain.
3. Traffic rules: yielding, signals, parking, turning wheels.
4. Stepped buildings and lots larger than one cell, for bigger landmarks.
5. A zone legend in the HUD, and zoning the owner can edit.
6. New geometry shapes such as pitched roof prisms. Each is a draw.
7. A separate sidewalk graph with crossings. Pedestrians follow road centre lines with an offset, which is enough at this scale.
8. Zone-specific ambient movers, day and night, and a world that reacts to work (the plan of record's own later list).

## Assumptions

- ASSUMPTION: "deterministic from the floor (same town every start)" is met by a town that is the same on every start and a pure function of the floor and one stored rectangle — chose this because the floor alone cannot stop a desk column from moving a line of buildings back and forth, and `held = null` restores the strict reading.
- ASSUMPTION: the detail level arrives as one value from Phase 12's `logic/quality.ts` — chose a local alias until it lands because that file is not on the branch yet.
- ASSUMPTION: "commercial or market" is one zone, the market street — chose this because a second retail zone adds a colour and no new behaviour.
- ASSUMPTION: the entertainment zone is for citizens now — chose this because sending agents there changes the sim's seating, which the brief says must not disturb a seated agent.
- ASSUMPTION: the HTML twin is not made for this file — chose this because it lives in `/tmp` for the dispatcher; it belongs with the plan of record when this is folded into it.
