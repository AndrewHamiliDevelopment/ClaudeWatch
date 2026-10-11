# ClaudeWatch 3D agent office — build plan, milestone 1

Date: 2026-10-11 · Branch: `feature/3d-office` · Source research: `docs/plans/claudewatch-sync-accounts-office-research-2026-10-11.md`

Validated: `node /tmp/cw-repro-2026-10-11/repro.mjs` printed `cd "/tmp/proj$(echo INJECTED-BY-FOLDER-NAME)"` → `sh` ran the substitution (`cd: /tmp/projINJECTED-BY-FOLDER-NAME`), root cause `src/main/terminal-opener.ts:6-8` (AppleScript-only escaping, then embedded in a shell `cd "…"` at `:47-49, :64, :76, :107-109`); and printed `{ "statusLine": … }` as the whole settings file after setup over an unparseable `settings.json`, root cause `src/main/rate-limit-reader.ts:139-157` (`catch {}` leaves `settings = {}`, then a non-atomic `writeFile`).

## Ledger

- [ ] Phase 0 — Base: branch, hotfix H1/H2 (TDD), real typecheck + lint, dependencies, build config, office contract
- [ ] Phase 1 — Platform: Electron 44, one sandboxed window factory, strict CSP, navigation locks (Codex)
- [ ] Phase 2 — Bridge: live session ingest and reducer in a utilityProcess (Codex)
- [ ] Phase 3 — Sim: deterministic building layout and agent behaviour, pure TS (Codex)
- [ ] Phase 4 — Scene: Office window renderer, R3F graybox building, HUD, list view (Claude @lena)
- [ ] Phase 5 — Look-first room: standalone Sims 3-look test in `labs/office-slice/` (Claude @lena + Codex images)
- [ ] Phase 6 — Integration: wire bridge → Office window, merge worktrees, STEP 6 gates, review, E2E video

## Owner decisions (this round)

| Question              | Answer                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| First build           | Both in parallel: live office inside ClaudeWatch, and the look-first test room |
| Mock-up               | None; the running graybox is the review artefact                               |
| Isolation             | Worktrees under `.claude/.worktree/`                                           |
| Codex                 | Work in combination; Claude decides the split (below)                          |
| Carried from research | Hybrid Orca accounts; floor = project; Sims 3 target; local only               |

## Scope

In this milestone: the two security hotfixes, the platform work the office cannot ship without, and office L0 (live graybox) plus the look-first room. A user opens **Office** from the tray and sees one building with a floor per project, an office per live Claude or Codex session, guest desks for subagents, characters whose activity follows the real session, an elevator panel, an attention queue, an inspector with jump to terminal, and a list view fallback.

Not in this milestone (next plan, from research §15): the accounts and limits cockpit, the statusline tee, the Claude Code hook plugin, Codex limits, Orca account mirroring, notifications, widget work, office L1 characters in the live app, L2 look, L3 life, web-page mode, Windows/Linux. The live office uses zero-install sources only, so nothing is written to `~/.claude` or `~/.codex`.

## Who does what: Claude and Codex

|                     | Claude (this session + Claude agents)                                                                                                                                                                                                                                                                                            | Codex (`codex exec` in its own worktree)                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Strengths used here | Architecture, contracts, cross-file integration, the 3D scene and HUD, running the app, screenshots, review, E2E video                                                                                                                                                                                                           | Self-contained implementation slices with clear tests; an independent second review; image generation                      |
| This milestone      | Phase 0, 4, 5 (code), 6                                                                                                                                                                                                                                                                                                          | Phase 1, 2, 3; textures, posters, screen and signage images for Phase 5 (cap 12 images); `codex-review.sh` pass in Phase 6 |
| Neither can         | Produce rigged 3D characters or motion-captured animation from nothing. Characters come from Microsoft Rocketbox (MIT); the missing typing loop is authored procedurally in code. Lightmap baking needs Blender, which is not installed, so the look-first room uses real-time lighting + GTAO and records what a bake would add |

## Architecture

```ascii
 sources (read-only, no tokens)        bridge utilityProcess              Office window (sandboxed)
+-------------------------------+     +--------------------------+       +---------------------------+
| <root>/sessions/<pid>.json    |---->| registry + liveness      |       | src/office/sim            |
| transcript tail (tool labels) |---->|  (LC_ALL=C TZ=UTC ps)    |  Msg  |  layout: floor=project    |
| subagents/*.meta.json         |---->| allowlist projection     |  Port |  FSM, dwell, grid A*      |
| Codex rollout session_meta    |---->| pure reducer -> Snapshot |------>|      | AgentView           |
| orca worktree ps --json (10s) |---->| FeedMessage hello/patch  |       |      v                    |
+-------------------------------+     +--------------------------+       | src/renderer/office (R3F) |
                                                                          | HUD, inspector, list view |
                                                                          +---------------------------+
```

- **Contract first** (`src/shared/office/`, written in Phase 0 and frozen before dispatch): `ProviderId`, `SessionRef`, `AgentActivity`, `AgentAttention`, `AgentEvent`, `OfficeSnapshot`, `FeedMessage` (hello+snapshot, patch with `seq`, resync), `AgentView`, `projectKey()`.
- **Bridge** owns truth, runs as an Electron `utilityProcess`, and posts patches over a `MessagePort` to the Office window. It reads labels only: tool name and category, never prompt text, tool input or output.
- **Sim** never imports three; fixed 10 Hz tick on the focused floor, 1 Hz elsewhere; deterministic layout persisted so desks do not move between runs.
- **Scene** only interpolates `AgentView`. Window is created lazily and destroyed on close; frame governor 30 / 10 / 0 fps; `powerPreference: 'low-power'`; DPR ≤ 1.5.

## File ownership

| Owner                   | Files (exclusive)                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary, Phase 0        | `package.json`, `package-lock.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.mjs`, `src/shared/office/**`, `src/renderer/office.html`, `src/main/terminal-opener.ts`, `src/main/rate-limit-reader.ts`, `src/main/settings-file.ts`, their tests |
| Codex platform, Phase 1 | `src/main/index.ts`, `src/main/tray.ts`, `src/main/ipc-handlers.ts`, `src/main/window-factory.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `electron-builder.yml`, `build/entitlements.mac.plist`                                                                            |
| Codex bridge, Phase 2   | `src/bridge/**`                                                                                                                                                                                                                                                                         |
| Codex sim, Phase 3      | `src/office/sim/**`                                                                                                                                                                                                                                                                     |
| @lena scene, Phase 4    | `src/renderer/office/**`                                                                                                                                                                                                                                                                |
| @lena slice, Phase 5    | `labs/office-slice/**` (own package; assets gitignored)                                                                                                                                                                                                                                 |
| Primary, Phase 6        | `src/main/office-window.ts`, `src/main/bridge-host.ts`, `src/preload/office.ts`, merge edits to `src/main/index.ts`                                                                                                                                                                     |

Phases 1–5 run in parallel. Phase 6 waits for all of them.

## Phases

### Phase 0 — Base (primary, inline)

- Branch `feature/3d-office` from `main`; leave the 135 mode-only flips unstaged.
- H1: `terminal-opener.ts` passes the path as `osascript` argv (`on run argv` + `quoted form of item 1 of argv`); keystroke openers type a quoted form built in AppleScript, never interpolated. Test: a path containing `"` and `$(…)` produces a script with no interpolated path.
- H2: new `settings-file.ts` (parse or abort, write temp + fsync + rename, keep a `.bak`); `setupStatusline` uses it. Test: an unparseable file is left untouched and setup returns false.
- `typecheck` → `tsc -b`; add `src/shared`, `src/bridge`, `src/office` to the right tsconfig projects; ESLint 9 flat config; vitest node environment for `src/bridge/**`, `src/office/sim/**`, `src/shared/**`.
- Dependencies: electron 44.7, electron-vite 5, electron-builder 26, three 0.186, @react-three/fiber 9.8, @react-three/drei 10.7, react/react-dom pinned ~19.3, @types/three.
- `electron.vite.config.ts`: second renderer entry `office.html`, main-side entry `bridge/index.ts`.
- Write the frozen contract in `src/shared/office/`.

Verify: `npm ci && npm run typecheck && npm run lint && npx vitest run` all exit 0.
Estimate: 8h with Claude | 20h without.

### Phase 1 — Platform (Codex)

Electron 44 code changes: `window-factory.ts` creating every window with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; preload works sandboxed; CSP without `'unsafe-eval'`; `will-navigate`, `setWindowOpenHandler` deny; IPC sender check and `settings:set` key allowlist; minimize-to-tray and popover behaviour unchanged.

Verify: `npm run typecheck && npx vitest run && npm run build` exit 0, then `npm run dev` opens the dashboard and popover with 0 console errors.
Estimate: 14h with Claude | 36h without.

### Phase 2 — Bridge (Codex)

`src/bridge/`: `registry.ts` (every config root's `sessions/*.json`; liveness by pid + `procStart` against `LC_ALL=C TZ=UTC ps -o lstart=`; never open `*.key`), `transcript-tail.ts` (last tool_use name per session, category map, `tool_use_id` pairing), `subagents.ts` (`subagents/*.meta.json`), `codex.ts` (live `codex` CLI sessions from rollout `session_meta` + process list, excluding `app-server` brokers), `orca.ts` (optional `orca worktree ps --json` every 10 s while the office is open, execFile with fixed argv, schema-validated, ignored when `CLAUDE_JOB_DIR` is set), `reducer.ts` (pure), `index.ts` (utilityProcess entry, `parentPort`, MessagePort feed). Fixture tests for every format.

Verify: `npx vitest run src/bridge` exits 0; `node out/main/bridge/index.js --once` prints a snapshot listing the live sessions on this Mac.
Estimate: 30h with Claude | 80h without.

### Phase 3 — Sim (Codex)

`src/office/sim/`: `layout.ts` (floor per `projectKey`, 6×6 m bays, 16 rooms per plate, wings per worktree, up to 4 guest desks then a team room; deterministic from ids, persisted map), `behaviour.ts` (per-agent FSM: arrive, work-at-desk, read, run, think, needs-you, done, leave; minimum dwell 1.5 s; burst coalescing), `path.ts` (grid A\* with 0.25 m sub-grid and named slots), `world.ts` (fixed tick, clamped delta, `AgentView[]` out). Pure TS, no three imports.

Verify: `npx vitest run src/office/sim` exits 0, including a 60-agent determinism test and a dwell test.
Estimate: 24h with Claude | 60h without.

### Phase 4 — Scene (@lena)

`src/renderer/office/`: R3F canvas (WebGL2 for L0; WebGPU is evaluated in Phase 5), Sims-style camera (orbit, tilt clamp 25–70°, three zoom bands), walls up / cutaway / down, focused floor only, stylised low-poly characters built from primitives with provider colours, status gem above each head, DOM HUD (attention queue with Next, elevator cross-section with per-floor counts, inspector with jump-to-terminal, list view), frame governor, metrics overlay. Developed against a fixture `FeedMessage` stream until Phase 6 wires the bridge.

Verify: `npx vitest run src/renderer/office` exits 0 and `npm run build` succeeds; screenshot of the graybox with the fixture feed.
Estimate: 30h with Claude | 80h without.

### Phase 5 — Look-first room (@lena + Codex images)

`labs/office-slice/`: standalone Electron 44 + three app. One 6×8 m office, 3 desks, 3 Rocketbox characters converted FBX → glTF with `fbx2gltf`, clips walk / sit / sit idles / talk plus a procedural typing loop, one shadowed key light, GTAO, HDRI, cutaway walls, orbit camera, WebGPU/WebGL2 switch, frame governor, measurement overlay. Codex generates wall art, monitor screens, signage and floor/wall material textures. Assets are downloaded by a script and gitignored, with an `ASSETS.md` licence manifest.

Verify: `npm --prefix labs/office-slice run build` exits 0; measurement table filled for both backends at 30/10/0 fps on this Mac; screenshots for your A/B.
Estimate: 36h with Claude | 80h without.

### Phase 6 — Integration and close (primary)

`bridge-host.ts` starts the utilityProcess; `office-window.ts` creates the Office window lazily, transfers the MessagePort, destroys on close; tray and dashboard get an **Office** entry; `preload/office.ts` relays the port. Merge worktrees in order 1 → 2 → 3 → 4. Then STEP 6: prettier, lint, typecheck, vitest, build, runtime smoke (Electron app, Office window, real sessions, 0 console errors). Wave 2 review @maya + @kai (risk 3: Electron upgrade). `codex-review.sh`. `/simplify`, dead-code scan, E2E MP4 of the live office to `recordings/`. Commit on the branch; no push without your go-ahead.

Verify: full STEP 6 chain exits 0; the Office window shows every live session on this Mac on its project floor.
Estimate: 18h with Claude | 46h without.

## Estimate

| Phase                   | Estimate                                               |
| ----------------------- | ------------------------------------------------------ |
| 0 Base                  | 8h with Claude \| 20h without                          |
| 1 Platform              | 14h with Claude \| 36h without                         |
| 2 Bridge                | 30h with Claude \| 80h without                         |
| 3 Sim                   | 24h with Claude \| 60h without                         |
| 4 Scene                 | 30h with Claude \| 80h without                         |
| 5 Look-first room       | 36h with Claude \| 80h without                         |
| 6 Integration and close | 18h with Claude \| 46h without                         |
| **Total**               | **160h with Claude \| 402h without** (2.5x, 60% saved) |

Wall-clock is shorter than the sum: Phases 1–5 run in parallel.

## Dispatch

Budget: T3 (5 active / 12 total Agent dispatches). Claude agents: @lena (Phase 4), @lena (Phase 5), @maya + @kai (Phase 6 review), one reserved fix slot. Codex runs through `codex exec -C <worktree>` in the background (Phases 1–3), so it does not consume Agent slots.

```ascii
 Phase 0 (primary: hotfix, deps, config, contract)  --> commit on feature/3d-office
   |
   +--> Phase 1 platform   [Codex, wt-platform]  ---+
   +--> Phase 2 bridge     [Codex, wt-bridge]    ---+
   +--> Phase 3 sim        [Codex, wt-sim]       ---+--> Phase 6 merge + gates + review + video
   +--> Phase 4 scene      [@lena, worktree]     ---+
   +--> Phase 5 look room  [@lena, worktree]     ---+   (independent; merged last)
```

## Risks

| Risk                                                     | Mitigation                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Electron 44 breaks the widget re-sign, updater or tray   | Phase 1 smoke covers tray and popover; packaging is checked but not released |
| Transcript tailing lags live tool state                  | Dwell and "busy" shorthand; hooks plugin follows in the next plan            |
| `orca worktree ps` cold-starts Orca's Electron each call | Poll only while the Office is open, 10 s, back off when Orca is down         |
| Rocketbox download is 3.9 GB                             | Sparse download of 3 avatars and the needed clips only                       |
| No Blender for lightmaps                                 | Real-time lighting + GTAO in the slice; bake is an L2 item                   |
| Parallel agents conflict                                 | Exclusive file ownership above; primary owns every shared config             |

## Assumptions

- ASSUMPTION: milestone = office L0 + look-first room + hotfix + platform — chose this because the full roadmap is about 1,000 h; everything else is the next plan.
- ASSUMPTION: no writes to `~/.claude` or `~/.codex` (no hook plugin, no statusline) — chose zero-install sources so the office can ship without touching your Claude setup.
- ASSUMPTION: local database question skipped — ClaudeWatch has no data layer.
- ASSUMPTION: tests stay colocated as `*.test.ts`, matching the repo's existing convention.

## Deviations

Phase 0 turned `npm run typecheck` and `npm run lint` from no-ops into real checks. These files were changed only to clear the 31 type errors and 66 lint problems that surfaced (FIX-IN-SESSION), plus the real popover icon bug the typecheck caught:

- `.gitignore` — ignore agent worktrees, plan workspaces, recordings, `*.tsbuildinfo`
- `tsconfig.node.json`, `tsconfig.web.json` — `rootDir: "."` and include `src/shared`, `src/bridge`, `src/office`, `src/renderer/lib`
- `src/renderer/env.d.ts` — `window.api` typed from the preload's `api` object (the stale duplicate `src/preload/index.d.ts` is deleted)
- `src/renderer/components/PopoverView.tsx` — status icon received the class `[object Object]`; now a status→class map
- `src/main/store.ts` — typed `Store<StoreSchema>`
- `src/main/widget-sync.ts` — dependencies narrowed with `Pick<>` so tests do not need full class instances
- `src/main/process-monitor.ts` — `terminalResolver` narrowed to `Pick<TerminalResolver, 'resolve'>`
- `src/main/platform/darwin.ts`, `src/main/sound-player.ts` — unused imports and callback params removed
- `src/main/bugfix-issues.test.ts`, `src/main/ipc-handlers.test.ts`, `src/main/notifications.test.ts`, `src/main/process-monitor.test.ts`, `src/main/rate-limit-reader.test.ts`, `src/main/sound-player.test.ts`, `src/main/store.test.ts`, `src/main/terminal-opener.test.ts`, `src/main/widget-stats-writer.test.ts`, `src/main/widget-sync.test.ts` — fixtures updated to current types, `Function` replaced with a typed callback, the IPC channel list updated for the popover channels added in `0d58b01`
- `src/renderer/__tests__/components.test.tsx`, `useInstances.test.ts`, `usePromoStatus.test.ts`, `useRateLimits.test.ts`, `useSettings.test.ts`, `useUpdater.test.ts`, `useUsage.test.ts` — mocks moved to the shared `api-mock.ts`, fixtures updated

The 135 mode-only changes (100644 → 100755) and 2 deleted Xcode user files in the working tree predate this session and are not part of this branch.
