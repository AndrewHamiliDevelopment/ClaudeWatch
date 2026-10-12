# ClaudeWatch Office: a compact, filled, living world

Validated: `npx vitest run src/office/sim/zz-repro-sprawl.test.ts` (a throwaway test, removed after the run) on `f072e04`. A project that saw 30 short sessions in a day with 2 still running came out as `{"bays":[0,31],"projectCapacity":32,"project":"24 x 56 m","company":"63 x 87 m","floor":"138 x 186 m","officeFloorShare":"2.4%"}` and failed `expected 56 to be less than 30`.

## Root causes

| Symptom                                                      | Root cause                                                                                                                                                                                                                           | Where                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A project office is mostly empty yard                        | A session's desk slot is held for 24 hours after it exits and a new session takes the next free slot, so slots only climb; capacity and depth are kept as running maximums                                                           | `src/office/sim/projects.ts:48` (`nextBay` over held slots), `src/office/sim/allocation.ts:15` (`reserveCapacity` keeps `previous`), `src/office/sim/projects.ts:67` (`Math.max(project.depth, …)`) |
| A company's grounds are far larger than its offices          | Every company is at least 63 × 87 m and project offices sit on a fixed 30 × 42 m pitch                                                                                                                                               | `src/office/sim/layout.ts:76`, `src/office/sim/allocation.ts:5-6`, `src/office/sim/allocation.ts:29-30`                                                                                             |
| The floor never shrinks                                      | Floor width and depth are running maximums, and the whole map (sizes included) is saved and reloaded                                                                                                                                 | `src/office/sim/layout.ts:105-114`, `src/renderer/office-live/live-feed.ts:40-49`                                                                                                                   |
| The world is cut off at the edges                            | The camera's far plane is fixed at 200 m while the floor above is 138 × 186 m, and the ground ends at the floor's edge                                                                                                               | `src/renderer/office/scene/OfficeScene.tsx:99`, `src/renderer/office/themes/ZoneArchitecture.tsx:146`                                                                                               |
| One skyline for every company                                | The world layer is drawn once per floor from the floor's default theme                                                                                                                                                               | `src/renderer/office/themes/types.ts` (`world`), `src/renderer/office/scene/WorldView.tsx:19`                                                                                                       |
| Changing the theme changes one office and nothing says which | The bar's theme button and the T key change only the zone that was last flown to; the "All offices" row has no theme control; each row's control is a 16 px two-colour square whose name is only in its tooltip                      | `src/renderer/office/hooks.ts:53-58`, `src/renderer/office/hud/OfficesPanel.tsx:62`, `src/renderer/office/hud/OfficeRow.tsx:75-92`                                                                  |
| The Office window cannot be dragged                          | The window hides its title bar and the Office page marks no area as draggable                                                                                                                                                        | `src/main/office-setup.ts:35`, `src/renderer/office/OfficeApp.tsx`                                                                                                                                  |
| Open Office does nothing when the window already exists      | The controller only calls `focus()`, which does not restore a minimized or hidden window or bring the app forward                                                                                                                    | `src/main/office-window.ts:36`                                                                                                                                                                      |
| Working agents wander instead of sitting at their desks      | When a neighbouring project or company changes size, every office after it slides over, and each agent in them was left where its desk used to be and walked to the new place; on the old 138 × 186 m floor those walks took minutes | `src/office/sim/world.ts:114-126` (a seat that moved always sent its agent walking)                                                                                                                 |

## Tickets

| Ticket                     | Status                                    | Source link                                          | Conversation                                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none — needs filing (LW-1) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Why does this show a huge space? As much as possible we want to compact the offices. It's like an evolving world or an increasingly bigger world Instead of having a lot of fucking spaces here"                                                                                                         |
| none — needs filing (LW-2) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "the world too is getting cutoff"                                                                                                                                                                                                                                                                         |
| none — needs filing (LW-3) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "You also need to add layers or more random models to fill the world as much as possible. I want to also have buildings displayed And we need to make sure that each of the models should reflect the theme that we have for each"                                                                        |
| none — needs filing (LW-4) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "I think we need to also make this livelier. We can draft a plan for us to make the world livelier and interesting Not just watching the agents. I think those cases and also agents that are already done, we can put them on an entertainment zone"                                                     |
| none — needs filing (LW-5) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Also when applying the team or changing the team, it only applies to a single office and I don't have a way to know. How can I apply different offices to each of the different companies or different offices so it doesn't apply to all and doesn't apply to any besides the first one?"               |
| none — needs filing (LW-6) | Done; follow-up commits on draft PR #3    | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "I detected another issue: the window for the office can't be dragged and when I try to open the office from the main ClaudeWatch, it doesn't open it or doesn't focus on it"                                                                                                                             |
| none — needs filing (LW-7) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Did you already include here the plan to make sure that this looks like a town? I can see the screen first and I need to have my player here so I can play with it and navigate to the office"                                                                                                           |
| none — needs filing (LW-8) | Planned; follow-up commits on draft PR #3 | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Additionally can we detect if Codex or Open Code is running? Can we detect those agents so it would also show on the ClaudeWatch office?"                                                                                                                                                                |
| none — needs filing (LW-9) | Done; follow-up commits on draft PR #3    | https://github.com/theangeloumali/ClaudeWatch/pull/3 | "Also I noticed that on the platform that we have right now, some agents are already working but they are not on their desk. I'm not sure what their behavior is. I'm not seeing them working but they are just going places, which is quite weird. Although it's interesting, they are not working fine" |

Per-item tier: LW-1 T2 (fix, sim logic, risk 1) · LW-2 T1 (fix, risk 1) · LW-3 T3 (five themes, risk 1) · LW-4 T2 (sim + scene, risk 1) · LW-5 T2 (HUD, risk 1) · LW-6 T1 (fix, main process and one component, risk 1) · LW-7 T2 (new scene feature, risk 1) · LW-8 T2 (new provider in the bridge, risk 2: it reads another tool's local database). Session profile T3, `BUDGET: T3 active=5 total=12`. One review at the end (Maya, risk 1).

## Ledger

- [x] Phase 1 — Compact floor: offices sized to who is there, companies packed tight, the floor grows and shrinks with the work
- [x] Phase 2 — Nothing is cut off: camera planes from the scene's size, ground to the horizon
- [x] Phase 3 — Surroundings engine: themed building lots and props around every company, drawn by that company's theme
- [x] Phase 4 — Lounge: each company has an entertainment zone; an agent whose turn is done walks there and walks back when work resumes
- [x] Phase 5 — Five themes filled in: buildings, props, lounge and ambient life for Neo Edo Steam, Brass Workshop, Violet Court, Orbital Garrison, Quiet Grove
- [x] Phase 6 — Themes you can see and set: one place that names every office's theme and sets it for everything, one company or one project
- [x] Phase 7 — The Office window can be dragged, and Open Office brings it to the front
- [ ] Phase 8 — A town you walk through: streets between the buildings, and a player the owner walks to any office
- [ ] Phase 9 — OpenCode agents in the Office, beside Claude and Codex
- [ ] Phase 10 — Ready for the owner: every test green, installed on this Mac, the two screenshots re-taken
- [ ] Phase 11 — Close, after the owner approves the changes: gates, review, cleanup, install, the two screenshots re-taken, demo re-recorded, pushed to PR #3

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

**Phase 7 — The Office window can be dragged, and Open Office brings it to the front (LW-6).** Owner: primary.

- Files: `src/main/office-window.ts`, `src/main/office-window.test.ts`, `src/main/office-setup.ts`, `src/main/index.ts`, `src/renderer/office/OfficeApp.tsx`, `src/renderer/office/main.tsx`, `src/renderer/office/__tests__/theme-office-app.test.tsx`.
- Validated: `npx vitest run src/main/office-window.test.ts` with the new cases failed 3 of 9 before the change (a second open neither restored nor showed the window, and the app was never brought forward).
- Open Office restores a minimized window, shows a hidden one, focuses it and brings the app in front of other apps. At login the window still opens without taking the keyboard.
- The app's window has a 36 px strip across the top to drag it by, and the panels start below it and below the window's own buttons. A browser tab has neither.
- Verify: `npx vitest run src/main/office-window.test.ts src/renderer/office/__tests__ && npm run typecheck`
- 0.5h with Claude | 2h without.

**Phase 8 — A town you walk through (LW-7).** Owner: H.

- Files: new files under `src/renderer/office/player/`, new `src/renderer/office/logic/streets.ts`, `src/renderer/office/scene/OfficeScene.tsx`, `src/renderer/office/scene/CameraRig.tsx`, `src/renderer/office/scene/Horizon.tsx`, `src/renderer/office/logic/office-reducer.ts`, `src/renderer/office/logic/hotkeys.ts`, `src/renderer/office/use-office-effects.ts`, `src/renderer/office/hud/BottomBar.tsx`, `src/renderer/office/OfficeApp.tsx`.
- Streets: the gaps between the building lots and an avenue from the gate are drawn as roads in the floor theme's colours, so the ring of buildings reads as a town with blocks. One draw.
- A player: the owner's own character stands at the gate when the Office opens. A Walk switch in the bar (and a key) turns walking on: the arrow keys and W A S D move the player relative to the screen, a click on the ground or on an office walks it there by the shortest path, and the camera goes with it. With walking off, every key and click does what it does today.
- The player walks the streets, the lanes and through doors, never through a wall, a desk or a building.
- Navigating to an office: choosing a company or project in the Offices panel while walking sends the player to its door. Standing next to an agent shows a prompt, and one key selects it, which opens the inspector with Talk and Focus terminal.
- The player wears the floor theme's colours and is plainly not an agent: it has its own shape and a ring under its feet.
- It is local to the page: nothing about it goes to the bridge, and it works on the view-only page.
- AC: with walking on, holding a key moves the player at a steady pace and the camera keeps it on screen; a click on an office two companies away walks it there through doors; no step ever lands inside a wall or a building lot; next to an agent the prompt appears and the key selects that agent; with walking off the existing hotkey and camera tests pass unchanged.
- Verify: `npx vitest run src/renderer/office && npm run typecheck && npx eslint src/renderer/office`
- 2.5h with Claude | 12h without.

**Phase 9 — OpenCode agents in the Office (LW-8).** Owner: I.

- Where things stand: Codex is already detected and shown (processes, rollouts, tokens). OpenCode is not: `ProviderId` is `'claude' | 'codex'` (`src/shared/office/types.ts:4`). OpenCode 1.19.0 is installed on this Mac and keeps its sessions in a local database (`~/.local/share/opencode/opencode.db`: a `session` table with the folder, title, parent session, agent, model and token counts; `part` and `message` tables for activity).
- Files: new `src/bridge/opencode.ts` and its tests, `src/bridge/io.ts`, `src/bridge/poller.ts`, `src/bridge/registry.ts`, `src/shared/office/types.ts`, the provider labels in `src/renderer/office/hud/`, one more provider skin in each theme's registration, `src/renderer/office/fixture/fixture-sessions.ts`.
- A running OpenCode process appears as a session with provider `opencode`: its folder decides the company and project, its latest session there gives the name, the activity, the current tool and exact tokens, and its child sessions are its subagents.
- The bridge opens the database read-only and reads named columns of the session, message and part tables only. It never opens `auth.json`, `mcp-auth.json`, or the account and credential tables. A missing, locked or changed database is a line in the source-health banner, never a crash. Queries are bounded: the database here holds about 123,000 sessions and 1.7 million parts.
- Each theme gives OpenCode agents their own look, as it does for Claude and Codex.
- Focus terminal works when the agent runs in an Orca pane. Talk and permission answers say they are not supported for this provider, as designed for anything the app cannot verify.
- AC: with a fixture database and a fixture process table, the feed carries an OpenCode session with the right folder, name, activity, tokens and one subagent; a database with an unknown shape gives a health reason and no session; the IO boundary refuses the two auth files and any query naming the credential or account tables; every theme has a third skin; the Office's totals include OpenCode tokens.
- Verify: `npx vitest run src/bridge src/renderer/office src/main && npm run typecheck && npx eslint src`
- 2h with Claude | 10h without.

**Working agents stay at their desks (LW-9).** Owner: primary. Done with Phase 4's files.

- Validated: `npx vitest run src/office/sim/seated-agents.test.ts` failed with `expected { x: 15, z: 8.3 } to deeply equal { x: 25, z: 8.3 }`: after a neighbouring project gained two desks, a working agent was still standing 10 m from its desk.
- A seated agent now moves with its desk when its office slides. An agent that is still walking in finishes its walk to where the desk now is. A patch that changes nothing about the map moves nobody.
- Files: `src/office/sim/world.ts`, `src/office/sim/world.test.ts`, `src/office/sim/seated-agents.test.ts`.
- Verify: `npx vitest run src/office/sim`

**Phase 10 — Ready for the owner.** Owner: primary.

- prettier, typecheck, eslint, the whole test suite, `npm run build`, `npm run build:office-web`, the seeded preview in a browser with 0 console errors.
- Install on this Mac and re-take the owner's two screenshots on live sessions: one company close up and the whole floor at the widest zoom.
- Then stop. The owner looks at the build and says whether the changes are approved.
- Verify: every command above exits 0; the installed app's Office shows the compact floor inside its town.
- 1h with Claude | 3h without.

**Phase 11 — Close, after the owner approves the changes.** Owner: primary, with Maya reviewing.

- The owner's instruction of 2026-10-12: "let's avoid doing the code review immediately. I'm going to ask you to do the code review once I approve all of the changes so we won't be wasting time."
- One review of the whole diff (with a security review of the OpenCode reader, which is risk 2), the cleanup pass, reuse audit, dead-code scan, fixes in session.
- Reinstall, re-record the demo, update the batch ledger and the checklist, update PR #3's description, push.
- Verify: every gate exits 0; `scope-check.sh` exits 0.
- 2h with Claude | 6h without.

## A livelier world: what is built now and what could follow

Built in this plan: a themed lounge per company, agents that go there when their turn is done, buildings and props around every company in its own theme, two ambient movers per theme, streets between the buildings, and a player the owner walks through the town to any office.

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
- ASSUMPTION: "my player" is one character the owner moves himself, with a switch between walking and today's camera controls — chose this because the arrow keys, W and E already pan, cut the walls away and rotate the map, and a switch keeps all of those working.
- ASSUMPTION: "looks like a town" means the buildings stand on streets with an avenue from the gate — chose this because the buildings are already there and roads are what turns a ring of buildings into blocks.
- ASSUMPTION: the question about Codex and OpenCode is a request to show OpenCode agents — chose to build it because Codex is already shown and OpenCode's sessions are readable on this Mac without any credential.
- ASSUMPTION: OpenCode tokens count in the Office's totals but are not filed under a Claude or Codex account — chose this because the accounts ledger attributes by sign-in, and reading OpenCode's account tables is exactly what the bridge must not do.
- ASSUMPTION: the later ideas above are a list, not phases — chose this because he asked for a draft plan to make the world livelier, and building all eight would delay the fixes he reported.
- ASSUMPTION: local-database question skipped — ClaudeWatch has no data layer.
- ASSUMPTION: the builders work in their own worktrees and the mock-up offer is skipped — chose this because the five themes already set the look each part must match.

## Deploy

Follow-up commits are pushed to `origin feature/prerelease-batch` (draft PR #3). No merge, no release, no force-push. The signed 1.3.0 release stays blocked on the Developer ID certificate.

## Estimate

Total **20h with Claude | 84h without** (about 4x): Phase 1 2|8, Phase 2 1|3, Phase 3 2|8, Phase 4 1.5|6, Phase 5 4|20, Phase 6 1.5|6, Phase 7 0.5|2, Phase 8 2.5|12, Phase 9 2|10, Phase 10 1|3, Phase 11 2|6. Phases 1, 2+3 and 6 run together; Phases 4 and 5 run together after them; Phase 10 ends with the install; Phase 11 waits for the owner's approval.

## Deviations

- Phase 6 also changed `src/renderer/office/hud/ThemesList.tsx` (new), `src/renderer/office/hud/themes-list.test.tsx` (new), `src/renderer/office/hud/hud-test-harness.tsx`, `src/renderer/office/hud/FocusNotice.tsx`, `src/renderer/office/logic/office-themes.test.ts`, `src/renderer/office/__tests__/bottom-bar.test.tsx`, `src/renderer/office/__tests__/theme-selection.test.tsx` and `src/renderer/office/__tests__/theme-office-app.test.tsx`: the three older tests asserted the bar's cycling button, which is gone.
- Phases 2 and 3 fit the planes in a new `src/renderer/office/scene/Horizon.tsx` (with `src/renderer/office/scene/horizon.test.tsx`) instead of `src/renderer/office/scene/CameraRig.tsx`, and added `src/renderer/office/scene/surroundings-view.test.tsx`, `src/renderer/office/__tests__/clip-planes.test.ts`, `src/renderer/office/__tests__/camera-bands.test.ts`, `src/renderer/office/themes/scene.test-utils.ts`, `src/renderer/office/logic/room-layout.ts` and `src/renderer/office/themes/layout.ts` (one shared definition each for the wall normals and the tower storey). `src/renderer/office/scene/FloorView.tsx` and `src/renderer/office/themes/types.ts` also carry the lounge part of the theme contract.
- Phase 1 runs in three passes: sizes from live sessions (done), project offices sized to their occupied desks with tight company packing (running), and a floor plate that is no longer mirrored around the gate (after the scene work is merged). It also changed `src/renderer/office-live/layout-geometry.test.ts`, and dropped the 24-hour hold on empty projects and companies.
- Phase 6 left `src/renderer/office/logic/office-reducer.ts` alone: an office stays focused once flown to, and the themes list says what the T key will change.
