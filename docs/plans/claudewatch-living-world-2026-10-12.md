# ClaudeWatch Office: a compact, filled, living world

Validated: `npx vitest run src/office/sim/zz-repro-sprawl.test.ts` (a throwaway test, removed after the run) on `f072e04`. A project that saw 30 short sessions in a day with 2 still running came out as `{"bays":[0,31],"projectCapacity":32,"project":"24 x 56 m","company":"63 x 87 m","floor":"138 x 186 m","officeFloorShare":"2.4%"}` and failed `expected 56 to be less than 30`.

## Root causes

| Symptom                                                      | Root cause                                                                                                                                                                                                      | Where                                                                                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A project office is mostly empty yard                        | A session's desk slot is held for 24 hours after it exits and a new session takes the next free slot, so slots only climb; capacity and depth are kept as running maximums                                      | `src/office/sim/projects.ts:48` (`nextBay` over held slots), `src/office/sim/allocation.ts:15` (`reserveCapacity` keeps `previous`), `src/office/sim/projects.ts:67` (`Math.max(project.depth, …)`) |
| A company's grounds are far larger than its offices          | Every company is at least 63 × 87 m and project offices sit on a fixed 30 × 42 m pitch                                                                                                                          | `src/office/sim/layout.ts:76`, `src/office/sim/allocation.ts:5-6`, `src/office/sim/allocation.ts:29-30`                                                                                             |
| The floor never shrinks                                      | Floor width and depth are running maximums, and the whole map (sizes included) is saved and reloaded                                                                                                            | `src/office/sim/layout.ts:105-114`, `src/renderer/office-live/live-feed.ts:40-49`                                                                                                                   |
| The world is cut off at the edges                            | The camera's far plane is fixed at 200 m while the floor above is 138 × 186 m, and the ground ends at the floor's edge                                                                                          | `src/renderer/office/scene/OfficeScene.tsx:99`, `src/renderer/office/themes/ZoneArchitecture.tsx:146`                                                                                               |
| One skyline for every company                                | The world layer is drawn once per floor from the floor's default theme                                                                                                                                          | `src/renderer/office/themes/types.ts` (`world`), `src/renderer/office/scene/WorldView.tsx:19`                                                                                                       |
| Changing the theme changes one office and nothing says which | The bar's theme button and the T key change only the zone that was last flown to; the "All offices" row has no theme control; each row's control is a 16 px two-colour square whose name is only in its tooltip | `src/renderer/office/hooks.ts:53-58`, `src/renderer/office/hud/OfficesPanel.tsx:62`, `src/renderer/office/hud/OfficeRow.tsx:75-92`                                                                  |

## Tickets

| Ticket                     | Status                                    | Source link                                          | Conversation                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none — needs filing (LW-1) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Why does this show a huge space? As much as possible we want to compact the offices. It's like an evolving world or an increasingly bigger world Instead of having a lot of fucking spaces here"                                                                                           |
| none — needs filing (LW-2) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "the world too is getting cutoff"                                                                                                                                                                                                                                                           |
| none — needs filing (LW-3) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "You also need to add layers or more random models to fill the world as much as possible. I want to also have buildings displayed And we need to make sure that each of the models should reflect the theme that we have for each"                                                          |
| none — needs filing (LW-4) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "I think we need to also make this livelier. We can draft a plan for us to make the world livelier and interesting Not just watching the agents. I think those cases and also agents that are already done, we can put them on an entertainment zone"                                       |
| none — needs filing (LW-5) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Also when applying the team or changing the team, it only applies to a single office and I don't have a way to know. How can I apply different offices to each of the different companies or different offices so it doesn't apply to all and doesn't apply to any besides the first one?" |

Per-item tier: LW-1 T2 (fix, sim logic, risk 1) · LW-2 T1 (fix, risk 1) · LW-3 T3 (five themes, risk 1) · LW-4 T2 (sim + scene, risk 1) · LW-5 T2 (HUD, risk 1). Session profile T3, `BUDGET: T3 active=5 total=12`. One review at the end (Maya, risk 1).

## Ledger

- [ ] Phase 1 — Compact floor: offices sized to who is there, companies packed tight, the floor grows and shrinks with the work
- [ ] Phase 2 — Nothing is cut off: camera planes from the scene's size, ground to the horizon
- [ ] Phase 3 — Surroundings engine: themed building lots and props around every company, drawn by that company's theme
- [ ] Phase 4 — Lounge: each company has an entertainment zone; an agent whose turn is done walks there and walks back when work resumes
- [ ] Phase 5 — Five themes filled in: buildings, props, lounge and ambient life for Neo Edo Steam, Brass Workshop, Violet Court, Orbital Garrison, Quiet Grove
- [ ] Phase 6 — Themes you can see and set: one place that names every office's theme and sets it for everything, one company or one project
- [ ] Phase 7 — Close: gates, review, cleanup, install, the two screenshots re-taken, demo re-recorded, pushed to PR #3

## How it fits

```ascii
 BEFORE (one company, 2 agents)                 AFTER (same 2 agents)

 +--------------------------------------+       far ring: tall buildings of the
 | company 63 x 87                      |       floor's theme (height <= 0.7 x
 |  +----------+                        |       distance, so nothing hides a desk)
 |  | project  |   empty                |         .  []  [ ]   []    [ ]  .
 |  | 24 x 56  |   yard                 |        +----------------------+
 |  | [a]      |                        |    [ ] | company, fits its    | []
 |  |          |                        |        |  +--------+ +------+ |
 |  |  empty   |                        |     ^  |  |project | |lounge| |  ^
 |  |  bays    |                        |   props|  |[a] [b] | | ~ ~  | | props
 |  |      [b] |                        |        |  +--------+ +------+ |
 |  +----------+                        |        +----------------------+
 +--------------------------------------+         '  []   [ ]    []     '
 floor 138 x 186, camera far plane 200          ground runs to the horizon
```

```ascii
 Wave 1 (parallel)            Wave 2 (parallel)                    Wave 3
 +------------------+         +---------------------------+        +---------+
 | A floor (sim)    |--+   +->| C lounge trips (sim)      |--+     |         |
 |  Phase 1 + lounge|  |   |  +---------------------------+  |     | review  |
 |  slot in the map |  +-->+->| D Neo Edo + Brass, poses  |--+---->| + gates |
 +------------------+  |   |  +---------------------------+  |     | + close |
 | B horizon (scene)|--+   +->| E Violet Court + Grove    |--+     |         |
 |  Phase 2 + 3     |      |  +---------------------------+  |     +---------+
 +------------------+      +->| F Orbital Garrison        |--+
                              +---------------------------+
```

## Phases

**Phase 1 — Compact floor (LW-1).** Owner: A.

- Files: `src/office/sim/allocation.ts`, `src/office/sim/projects.ts`, `src/office/sim/layout.ts`, `src/office/sim/rooms.ts`, `src/office/sim/layout.test.ts`, `src/renderer/office-live/layout-geometry.ts`, `src/renderer/office/scene-model.ts`, `src/shared/office/types.ts`, `src/renderer/office/fixture/fixture-layout.ts`.
- A project office is as large as the sessions in it now: a new session takes the lowest free desk slot, and a slot is free the moment its session is gone. Sizes are computed on every build and never read back from a saved map.
- A company's grounds fit its project offices and its lounge, with a 3 m lane between them and no minimum size. Companies pack beside each other in rows, largest first, 3 m apart.
- The floor is the box around the companies plus a margin. It grows when work arrives and shrinks when it leaves.
- A live session keeps its desk when another session arrives. A session may be moved to a lower slot only when another one leaves, and it walks there.
- A map saved by the current version loads and comes out compact, with no reset by the owner.
- Each company gets a lounge in its grounds: at least 6 × 5 m with 4 seats, growing by 4 seats per 4 agents. `ZoneGeometry.lounge?: LoungeGeometry` carries it to the scene; `AgentView.place?: 'lounge'` is declared here and set in Phase 4.
- AC: the reproduction above gives a project no deeper than 18 m with both sessions in slots 0 and 1, and a floor under 3,000 m² (from 25,668). On a seeded floor of 3 companies, 8 projects and 12 sessions, project offices and lounges cover at least 30% of the floor (from under 3%), nothing overlaps, every lane is at least 3 m, and the same input gives the same map.
- Verify: `npx vitest run src/office src/renderer/office-live src/renderer/office/fixture && npm run typecheck`
- 2h with Claude | 8h without.

**Phase 2 — Nothing is cut off (LW-2).** Owner: B.

- Files: `src/renderer/office/scene/OfficeScene.tsx`, `src/renderer/office/scene/CameraRig.tsx`, `src/renderer/office/logic/camera-bands.ts`, `src/renderer/office/scene/office-scene.test.tsx`, `src/renderer/office/scene/camera-rig.test.tsx`.
- Near and far planes are set from the scene's size (floor plus surroundings) whenever it changes, at every map rotation and at the widest zoom.
- A ground plane in the floor theme's colours reaches past the edge of the view at the widest zoom, so the floor never ends in a void.
- AC: with a 300 × 300 m floor, every corner of the floor and of the outermost building lot is inside the camera's planes at all four rotations; a screenshot at the widest zoom shows ground to every edge of the window.
- Verify: `npx vitest run src/renderer/office/scene src/renderer/office/logic && npm run typecheck`
- 1h with Claude | 3h without.

**Phase 3 — Surroundings engine (LW-3).** Owner: B.

- Files: `src/renderer/office/themes/types.ts`, `src/renderer/office/themes/surroundings.ts` (new), `src/renderer/office/themes/surroundings.test.ts` (new), `src/renderer/office/scene/WorldView.tsx`, `src/renderer/office/scene/FloorView.tsx`, `src/renderer/office/themes/geometry-budget.test.ts`, `src/renderer/office/themes/live-budget.test.tsx`.
- A pure function turns a floor into lots: building lots in a ring around the floor and in the gaps between companies, and small prop spots along lanes and walls. Placement is seeded by the zone id, so it is the same on every start and does not jump when an agent arrives.
- Each lot belongs to the nearest company and is drawn by that company's theme (`Surroundings` on the theme's zone kit); the far ring is drawn by the floor's theme. A second optional part, `Ambient`, holds a theme's moving things.
- Nothing may hide a desk: a lot's height limit is 0.7 × its distance from the nearest office, which holds at every map rotation at the camera's 35° elevation.
- AC: lots never overlap a zone, a lane, a door or each other; the height rule holds for every lot; three themes on one floor with 60 agents stay within 300 draw calls.
- Verify: `npx vitest run src/renderer/office/themes src/renderer/office/scene && npm run typecheck`
- 2h with Claude | 8h without.

**Phase 4 — Lounge (LW-4).** Owner: C (sim), D (poses).

- Files: `src/office/sim/behaviour.ts`, `src/office/sim/world.ts`, `src/office/sim/navigation.ts`, `src/office/sim/placements.ts`, `src/office/sim/behaviour.test.ts`, `src/office/sim/world.test.ts`, `src/renderer/office/themes/rig.ts`, `src/renderer/office/scene/Robot.tsx`.
- An agent whose turn has ended (`attention: 'done'`) and that has been idle for 20 s walks to a free seat in its company's lounge. When it works again, or needs the owner, it walks back to its own desk. Its desk stays its own.
- A full lounge leaves the agent at its desk. A finished subagent that is still listed goes too.
- Name cards, selection, Focus terminal and fly-to follow the agent wherever it is.
- AC: in the sim, done + 20 s idle ends at a lounge seat with `place: 'lounge'`; a new activity ends back at the same desk with no `place`; an agent that needs the owner is never in the lounge.
- Verify: `npx vitest run src/office src/renderer/office && npm run typecheck`
- 1.5h with Claude | 6h without.

**Phase 5 — Five themes filled in (LW-3, LW-4).** Owners: D (Neo Edo Steam, Brass Workshop), E (Violet Court, Quiet Grove), F (Orbital Garrison).

- Files: every theme's own files under `src/renderer/office/themes/` (`Edo*.tsx`, `Brass*.tsx`, `ZoneKits.tsx`, `builtins.ts`, `violet-court/**`, `quiet-grove/**`, `orbital-garrison/**`) and one new file per theme for its surroundings and its lounge.
- Each theme supplies: at least 4 building designs and 6 props in its own style, a lounge that looks like that theme's place to rest, a lounging pose for its characters, and 2 ambient movers that stop under reduced motion.
- Original designs and names only, as in the rest of the repo.
- AC: every theme draws all four parts; a floor with all five themes stays within 300 draw calls at 60 agents; a still frame shows no building over a desk.
- Verify: `npx vitest run src/renderer/office && npm run typecheck && npx eslint src/renderer/office`
- 4h with Claude | 20h without.

**Phase 6 — Themes you can see and set (LW-5).** Owner: G.

- Files: `src/renderer/office/hud/BottomBar.tsx`, `src/renderer/office/hud/OfficesPanel.tsx`, `src/renderer/office/hud/OfficeRow.tsx`, `src/renderer/office/hud/ThemePicker.tsx`, `src/renderer/office/hud/theme-picker.test.tsx`, `src/renderer/office/hooks.ts`, `src/renderer/office/OfficeApp.tsx`, `src/renderer/office/logic/office-themes.ts`, and one new HUD file for the themes list.
- One place lists every company and project with the name of the theme it uses, and says when it follows its company or the floor.
- From there a theme can be set for every office at once, for one company, or for one project, and a single office can be put back to following its parent.
- The bar's button opens that list. The T key still cycles, and every change is followed by a short notice naming the office that changed.
- AC: with three companies, choosing a theme for each gives three different themes on screen and in the list; "every office" removes the overrides; no control changes a theme without naming its scope; all of it works by keyboard.
- Verify: `npx vitest run src/renderer/office && npm run typecheck && npx eslint src/renderer/office`
- 1.5h with Claude | 6h without.

**Phase 7 — Close.** Owner: primary, with Maya reviewing.

- prettier, typecheck, eslint, the whole test suite, `npm run build`, `npm run build:office-web`, the seeded preview in a browser with 0 console errors.
- One review of the whole diff, cleanup pass, reuse audit, dead-code scan, fixes in session.
- Install on this Mac and re-take the owner's two screenshots on live sessions: the ClearSpent company and the whole floor at the widest zoom.
- Re-record the demo, update the batch ledger and the checklist, update PR #3's description, push.
- Verify: every command above exits 0; `scope-check.sh` exits 0; the installed app's Office shows the compact floor.
- 2h with Claude | 6h without.

## A livelier world: what is built now and what could follow

Built in this plan: a themed lounge per company, agents that go there when their turn is done, buildings and props around every company in its own theme, and two ambient movers per theme.

Ideas for later, in the order I would build them. None is built here.

1. **The world reacts to work.** A project's building lights up while its agents work and dims when they stop; a company with a waiting agent raises a flag you can see from the widest zoom.
2. **Rituals.** A finished task is a small scene: the agent rings a bell, launches a lantern or plants a tree, and the day's count shows as lanterns or trees in the company's yard.
3. **Day and night.** The light follows the clock on this Mac; night work is lamp-lit windows.
4. **Agents meet.** Two agents in the same lounge sit together; a lead and its teammates walk to a table for a stand-up when the team starts.
5. **Token weather.** A company's spend today is the height of a smoke stack, a waterfall or a reactor glow, so a heavy day is visible without a number.
6. **Visitors.** Courier drones, carts or spirits carry a parcel between two projects when one agent's work lands in another's folder.
7. **A history you can walk.** Yesterday's finished work stays as small monuments at the edge of the grounds for a week.
8. **Limits as terrain.** As an account nears its limit, the ground around its companies frosts over or floods.

## Assumptions

- ASSUMPTION: this work goes on `feature/prerelease-batch` as follow-up commits to draft PR #3 — chose this because these are the owner's findings on that batch before release, and his go-ahead for the branch covers follow-up commits on it. Nothing is merged.
- ASSUMPTION: a session's desk slot is freed as soon as the session is gone, instead of being held for 24 hours — chose this because the 24-hour hold is what produces the empty yard, and a returning session taking the next free desk costs nothing.
- ASSUMPTION: one lounge per company, not one for the whole floor — chose this because themes belong to companies, so each lounge can look like its own theme.
- ASSUMPTION: "agents that are already done" means an agent whose turn has ended and that is waiting for the next instruction — chose this because a session that has exited is no longer in the feed and leaves the floor.
- ASSUMPTION: 20 s of idling before the walk to the lounge — chose this so an agent between two quick turns does not pace back and forth.
- ASSUMPTION: buildings stay low near the offices and rise with distance — chose this because the owner's bar is that he can always see the agents working at their tables.
- ASSUMPTION: the later ideas above are a list, not phases — chose this because he asked for a draft plan to make the world livelier, and building all eight would delay the fixes he reported.
- ASSUMPTION: local-database question skipped — ClaudeWatch has no data layer.
- ASSUMPTION: the builders work in their own worktrees and the mock-up offer is skipped — chose this because the five themes already set the look each part must match.

## Deploy

Follow-up commits are pushed to `origin feature/prerelease-batch` (draft PR #3). No merge, no release, no force-push. The signed 1.3.0 release stays blocked on the Developer ID certificate.

## Estimate

Total **14h with Claude | 57h without** (about 4x): Phase 1 2|8, Phase 2 1|3, Phase 3 2|8, Phase 4 1.5|6, Phase 5 4|20, Phase 6 1.5|6, Phase 7 2|6. Phases 1, 2+3 and 6 run together; Phases 4 and 5 run together after them; Phase 7 is last.

## Deviations

None yet.
