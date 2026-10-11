# ClaudeWatch: sync, multi-account limits and the agent office — research report

Date: 2026-10-11 · Repo state: `main` at `e627678` (v1.2.15), level with `origin` and `nas`, nothing to pull · Machine: Claude Code 2.1.296, Codex CLI 0.162.1, Orca 1.4.224 on disk (the running Orca is 1.4.220)

This is a research report. It changes no code. Everything below comes from 16 research agents in two rounds: 8 research lanes, then 2 adversarial verifiers, a fidelity lane, 4 design lanes and a red-team critic. The method is in the appendix.

## Owner decisions (binding)

| Decision                                 | Answer                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Relationship with Orca's accounts        | Hybrid: ClaudeWatch keeps its own account list and also mirrors Orca's               |
| What a floor represents in the 3D office | One floor per project; sessions are offices on that floor, subagents sit around them |
| Visual fidelity target                   | Close to The Sims 3                                                                  |
| Where this report lives                  | Main checkout, uncommitted                                                           |

## 1. Executive summary

**ClaudeWatch is out of sync in ways users can see.** On this machine it shows no rate limits at all, it counts phantom sessions, it cannot see Codex, accounts or Orca, and its weekly bar is built on a guessed 2,000 tokens per tool call. Two defects in the shipped public app are security bugs: a shell injection when opening a terminal, and a statusline installer that can replace a broken `~/.claude/settings.json` with a file that only holds a statusline, which would delete all 48 hook entries, including the destructive-guard hook. Those two should ship as a v1.2.16 hotfix before any redesign.

**Multi-account Claude: the official route is one config folder per account, and that is what ClaudeWatch should build.** Claude Code documents `CLAUDE_CONFIG_DIR` for "multiple accounts side by side". ClaudeWatch can own a folder per account, sign in through the unmodified `claude` login, and "switch" by starting new sessions under another folder. It never touches a token. Orca 1.4.x works differently: it swaps one global credential, and that swap also hits Claude sessions that Orca did not launch. Orca's main branch has already moved to per-account folders (#26801, merged 2026-10-09), in no release yet.

**Hybrid with Orca works without secrets.** `orca account list --json` returns Orca's Claude accounts, the active one, and cached Claude and Codex limits, with no tokens. When Orca is closed, its `oauth-account.json` files still give the account list. ClaudeWatch should mirror these read-only and hand off to Orca's own switcher for Orca accounts.

**One owner decision cannot be fully met as stated: limits for every account "the way Orca shows them".** Orca gets idle-account numbers by reading each account's OAuth token and calling an undocumented endpoint. Anthropic's terms forbid third parties from collecting, storing or intermediating Claude.ai credentials, and the security lane vetoes it. Without it, an account has live numbers only while one of its sessions is running (statusline), plus whatever cache happens to match. Idle accounts show "last known, as of" or "unknown". You need to accept that, or reopen the veto knowing the risk to your accounts (section 15, question 1).

**Codex limits are easy.** Codex writes `rate_limits` into its local session files on every turn, and its documented `app-server` can fetch fresh ones. Neither needs ClaudeWatch to read a credential.

**The 3D office is feasible; content is the hard part, not rendering.** three.js with react-three-fiber on Electron 44 can render past what The Sims 3 shipped with. The constraints are characters, animation and power use. The plan uses Microsoft Rocketbox characters (MIT, 115 avatars, 471 clips but no typing clip), Blender-baked lighting, only the focused floor rendered, and a window that is destroyed on close so a closed office costs nothing. A one-room vertical slice measured on a base-model Mac decides whether the look is good enough before money goes into art.

**Effort.** About 1,010 h with Claude Code against about 2,250 h without (2.2x, 55% saved) for everything through Sims-like polish. The useful first ship (accounts and limits cockpit plus a live office with real characters) is about 500 h with Claude against about 1,240 h without. The Sims 3 look itself (L2) and Sims-like life (L3) are 500 h more and are art-bound, where AI speeds things up least. Optional paid art is $7k to $22k.

## 2. ClaudeWatch today: what is broken or out of sync

ClaudeWatch has not shipped since 2026-03-23. Claude Code has released about 210 patch versions since then.

### Security defects in the shipped app (hotfix first)

| #   | Defect                                                                                                                                                                                               | Evidence                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| H1  | Shell injection: a session folder name containing `"` or `$(...)` runs commands when the user clicks Open Terminal. The path is escaped for AppleScript only, then embedded in a shell `cd "<path>"` | `src/main/terminal-opener.ts:6-8`, used at `:47-49, :64, :76, :107-109`          |
| H2  | `setupStatusline()` treats an unparseable `~/.claude/settings.json` as `{}` and writes back only `statusLine`, non-atomically                                                                        | `src/main/rate-limit-reader.ts:139-157`                                          |
| H3  | IPC handlers do not check the sender, and `settings:set` accepts any key                                                                                                                             | `src/main/ipc-handlers.ts:15`                                                    |
| H4  | `sandbox: false` on both windows; CSP allows `'unsafe-eval'`; no Electron fuses; no navigation or window-open guards                                                                                 | `index.ts:47`, `tray.ts:105`, `renderer/index.html:9`                            |
| H5  | Electron 34.5.8 is end of life (supported majors are 42–44; 44.7.0 is current; 34 shipped Chromium 132)                                                                                              | releases.electronjs.org                                                          |
| H6  | The public repo tracks 19 xcarchive/dSYM/provisioning files, including two development provisioning profiles that each carry one device UDID. There is no LICENSE                                    | `widget/ClaudeWatchHost.xcarchive/**`; `gh repo view` shows PUBLIC, licence null |

### Functional defects

| #   | Problem                                                                                                                                                                                                                | Evidence                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| C1  | No rate-limit data on this machine: `~/.claude/cache/rate-limits.json` does not exist because the one `statusLine` slot belongs to `gsd-statusline.js`, and setup reports success without installing                   | `rate-limit-reader.ts:117-126, 147-150`                        |
| C2  | The statusline script is not packaged into the app, so setup fails even when the slot is free                                                                                                                          | `electron-builder.yml:40-42`                                   |
| C3  | The script parses `resets_at` as a quoted string; Claude Code sends Unix epoch seconds, so the reset time is always empty and decimals are truncated                                                                   | `resources/claudewatch-statusline.sh:15-18`                    |
| C4  | One global limits file, written non-atomically. With several accounts the last session to render wins                                                                                                                  | `claudewatch-statusline.sh:7, 21-23`                           |
| C5  | Two `claude --chrome-native-host` processes counted as sessions (12 matches, 10 real)                                                                                                                                  | `platform/darwin.ts:20-28`                                     |
| C6  | `cpuIdleThreshold`, `pollingIntervalMs`, `theme` and `notifications.onError` do nothing                                                                                                                                | `index.ts:108, 229`; `process-monitor.ts:90`                   |
| C7  | Promo checker hard-coded to 2026-03-13..27 and still polling                                                                                                                                                           | `promo-checker.ts:4-6`                                         |
| C8  | Exited count lives in memory; Clear History leaves it; the "Exited" filter can never match                                                                                                                             | `session-tracker.ts:91, 224-249`                               |
| C9  | The weekly bar reads 1,256 `session-usage-ppid-*.json` files every 30 s. They are written by a local hook outside ClaudeWatch that estimates 2,000 tokens per tool call, so the 64.7M figure is not a real token count | `usage-stats.ts:38, 91-128`; verifier A11                      |
| C10 | Session id only comes from `--resume`; 6 of 10 live sessions have none                                                                                                                                                 | `process-monitor.ts:37-40`                                     |
| C11 | `npm run typecheck` checks nothing (`tsconfig.json` is `{files: [], references}` and the script has no `-b`); `npm run lint` has no ESLint 9 flat config                                                               | `tsconfig.json`; `package.json:20`                             |
| C12 | Windows: project path is the exe directory and status is always idle; Linux falls through to the macOS detector                                                                                                        | `win32.ts:44-46, 63-88`; `process-monitor.ts:59-64`            |
| C13 | `window.api` is typed twice and has drifted; README describes a CI workflow and `config.json` that do not exist                                                                                                        | `preload/index.d.ts`, `renderer/env.d.ts`; `README.md:176-178` |

It is also blind to what now matters: Codex (30+ processes here, many of them plugin brokers rather than sessions), accounts, Orca panes (9 of 10 live Claude sessions run inside Orca), and the "needs input" state.

Working tree note: 135 files show a mode-only change (100644 to 100755) and 2 Xcode user files are deleted. No content changed. Resolve these separately from feature work.

## 3. How Orca does multiple accounts

Source read at the installed tag (`stablyai/orca` v1.4.224, MIT, commit `2bb20586`), checked against Orca's public `main`.

**Claude accounts in Orca 1.4.x: one global credential, swapped on switch.**

| Step         | What Orca does                                                                                                                                                                                                         | Source                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Add          | Spawns `claude auth login --claudeai` with `CLAUDE_CONFIG_DIR` and `CLAUDE_SECURESTORAGE_CONFIG_DIR` set to a temp dir, then captures the credential                                                                   | `claude-login-session.ts:54-65`; `claude-auth-capture.ts:86-109`         |
| Store        | Keychain service `Orca Claude Code Managed Credentials` (account = Orca UUID); identity in `oauth-account.json`, which holds no token                                                                                  | `keychain.ts:11-12`                                                      |
| De-duplicate | Lowercased email + `organizationUuid` + runtime scope                                                                                                                                                                  | `claude-duplicate-account.ts:38-55`                                      |
| Switch       | Writes the incoming credential to `~/.claude/.credentials.json`, the unscoped `Claude Code-credentials` Keychain item, the scoped item for `~/.claude`, and `oauthAccount` in `~/.claude.json`. One selection per host | `runtime-auth/runtime-auth-sync.ts:259-280`; `runtime-selection.ts:7-57` |
| Refresh      | `POST https://platform.claude.com/v1/oauth/token`, skipped while any Claude process Orca spawned is live                                                                                                               | `oauth-refresh.ts:9-15`; `live-pty-gate.ts:77-122`                       |

Consequences, verified:

- The switch is host-wide. Claude sessions started outside Orca also bill the newly selected account (Orca issue #16016).
- A session already running under account A keeps A's token in memory, but whichever side refreshes next writes into the shared Keychain item. The outcome is racy in both directions (verifier A12; reasoned from source and issue #23542, not observed).
- Orca's `main` re-landed per-account folders on 2026-10-09 (#26801): `<userData>/claude-profiles/<accountId>/home`, `~/.claude` copied in before every launch, and a per-pane pointer env `ORCA_CLAUDE_PROFILE_POINTER`. When that ships, ClaudeWatch must also scan `claude-profiles/*/home/sessions`.

**Codex accounts in Orca: one `CODEX_HOME` per account.** Each account has its own home with its own `auth.json`, so nothing races. A per-pane registry records which account each pane started under.

**What ClaudeWatch can read from Orca without touching secrets.**

| Need                                                | Source                                                                                         | Caveat                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts, active id, cached Claude and Codex limits | `orca account list --json` (0.12 s wall time)                                                  | Needs Orca running. The ACTIVE account's limits are null while Orca has live Claude panes (`failureKind: deferred-by-live-session`). Inactive accounts are filled only after Orca's Accounts pane has been opened (2 of 3 present here) |
| Per-pane agent state                                | `orca worktree ps --json`, or RPC `session.tabs.listAll`                                       | Each CLI call cold-starts Orca's Electron binary; poll slowly                                                                                                                                                                           |
| Account list when Orca is closed                    | `<orca>/claude-accounts/*/auth/oauth-account.json`                                             | Identity only; no limits                                                                                                                                                                                                                |
| Floor for an Orca session                           | `ORCA_WORKTREE_ID` = `<repoUuid>::<path>` in the pane environment                              | Wrong for backgrounded Claude jobs (`CLAUDE_JOB_DIR` set; Orca's own scripts skip them)                                                                                                                                                 |
| Switch the Claude account                           | Not possible through the 1.4.224 CLI. Open PR #26870 adds `orca account select --agent claude` | The RPC `accounts.selectClaude` works for any process holding the `authToken` from `orca-runtime.json`. Vetoed for ClaudeWatch (section 12)                                                                                             |

Never read: `claude-runtime-auth/system-default-auth.json` and `codex-runtime-home/*auth*.json` (plaintext credential blobs), `orca-runtime.json` (owner-scope token), the Keychain.

## 4. Where usage limits can come from

| Source                                                    | Claude                                                                                                                                    | Codex                                                                                                                          | Network or credential? | Verdict                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Statusline stdin JSON                                     | `rate_limits.five_hour / seven_day / spend_limit` (`used_percentage`, `resets_at` in epoch seconds) for the account the session uses      | n/a                                                                                                                            | No                     | Primary live source. Absent before a session's first API response and for API-key users                                              |
| `~/.claude.json` `cachedUsageUtilization`                 | `limits[]` with kinds `session`, `weekly_all`, `weekly_scoped` (e.g. Fable) and `seven_day_breakdown` (here: Claude Code 42%, Cowork 58%) | n/a                                                                                                                            | No                     | Use only when its `accountUuid` equals `oauthAccount.accountUuid`; show its age (it was 16.6 h old and for a different account here) |
| Hook events                                               | `StopFailure` with `error=rate_limit`, `quota_auto_resume_*` notifications                                                                | n/a                                                                                                                            | No                     | Marks a window as hit                                                                                                                |
| Codex rollout JSONL                                       | n/a                                                                                                                                       | `token_count.rate_limits.primary/secondary` (`used_percent`, `window_minutes`, `resets_at` in seconds), `credits`, `plan_type` | No                     | Primary. Stale between turns. Here the 10,080-minute window is `primary` and `secondary` is null, so classify by duration            |
| `codex app-server` `account/rateLimits/read`              | n/a                                                                                                                                       | Fresh limits, `rateLimitsByLimitId`, reset credits                                                                             | Codex's own client     | Allowed (documented); opt-in, on demand                                                                                              |
| Orca CLI cache                                            | Inactive Orca accounts                                                                                                                    | Codex                                                                                                                          | No                     | Show `updatedAt`; often stale                                                                                                        |
| `api.anthropic.com/api/oauth/usage` with a Keychain token | Every account, any time                                                                                                                   | n/a                                                                                                                            | Reads a token          | Vetoed (legal and security)                                                                                                          |
| `chatgpt.com/backend-api/wham/usage` with a stored token  | n/a                                                                                                                                       | Every account                                                                                                                  | Reads a token          | Vetoed                                                                                                                               |

Window labels must come from the window's real duration (300 min = "5-hour", 10,080 = "Weekly", scoped weekly adds the model name), never hard-coded 5h/7d.

## 5. What Claude Code and Codex expose now

| Surface                               | Yields                                                                                                                                                                                                            | Documented                                                               | Use                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `~/.claude/sessions/<pid>.json`       | pid, sessionId, cwd, name, status (busy, idle, waiting, shell), waitingFor (only while waiting), procStart (UTC), version                                                                                         | No                                                                       | Live session roster for every config root. Never open the sibling `.key` files                    |
| `claude agents --json`                | id, state, status, waitingFor; per config root                                                                                                                                                                    | Yes ("the supported way to read session state from outside Claude Code") | Not polled in v1: it may start the background supervisor (undocumented) and runs per config root  |
| Hooks                                 | 33 events; `async` exists only on command hooks; `http` hooks are rejected on `SessionStart` and `Setup`; `PermissionRequest` is immediate while `permission_prompt` waits about 6 s and `idle_prompt` about 60 s | Yes                                                                      | Live event bus, shipped as a Claude Code plugin                                                   |
| Plugins                               | Can ship `hooks/hooks.json` and `subagentStatusLine`, cannot ship `statusLine`. Installed plugins are copied to a versioned cache, so updates need a version bump                                                 | Yes                                                                      | Install hooks without editing `settings.json`; keep `hooks.json` minimal and call a stable script |
| `subagentStatusLine`                  | every visible subagent row (name, agentType, description, tokenCount) per tick                                                                                                                                    | Yes                                                                      | Extra live subagent feed for the office                                                           |
| Transcripts and `subagents/` sidecars | messages, usage, subagent tree                                                                                                                                                                                    | Location only; format "changes between versions"                         | Fallback and backfill                                                                             |
| `CLAUDE_CONFIG_DIR`                   | separate settings, history, credentials and Keychain entry per folder                                                                                                                                             | Yes, explicitly for multiple accounts                                    | Account model. The docs do not say where `.claude.json` lives when it is set; prototype 2 checks  |
| Codex hooks                           | 12 events; skipped until the user trusts them in `/hooks`                                                                                                                                                         | Yes                                                                      | Optional; rollouts are enough for v1                                                              |

Older Claude Code versions (before 2.1.101) throw away the whole `settings.json` when the hooks block names an unknown event. Any hook installer must gate event names on the installed version, or ship hooks as a plugin.

## 6. Market and positioning

Session status alone is no longer a product: Claude Code ships an agents view, background sessions and `/usage` natively. Nobody combines accurate limits, several accounts, both providers and live session state in one native surface. Orca comes closest, but it is a workspace you work inside.

| Tool                        | Claude limits | Codex limits | Multi-account | Switch                  | Session monitor    | Widget    |
| --------------------------- | ------------- | ------------ | ------------- | ----------------------- | ------------------ | --------- |
| ClaudeWatch 1.2.15          | Broken        | No           | No            | No                      | ps-based           | WidgetKit |
| CodexBar (22.4k stars)      | Yes           | Yes          | Partial       | No                      | No                 | WidgetKit |
| Claude-Usage-Tracker (3.6k) | Yes           | Yes          | Yes           | Per-profile config dirs | No                 | No        |
| claude-swap (3.3k)          | Yes           | No           | Yes           | Credential swap         | No                 | Menu bar  |
| cc-switch (142.5k)          | Yes           | Yes          | Beta          | Config rewrite + proxy  | No                 | Tray      |
| Orca (89.3k)                | Yes           | Yes          | Yes           | Yes                     | It runs the agents | No        |
| Pixel Agents (9.6k)         | Roadmap       | Roadmap      | No            | No                      | 2D office          | No        |

The most common complaint about competitors is repeated Keychain prompts (CodexBar issues #340, #108, #2115). A tool that never reads a credential avoids that and stays on the right side of Anthropic's terms.

Where ClaudeWatch can be clearly better: Claude and Codex side by side across accounts; Orca-aware without depending on Orca; token-free by design; the native widget; the 3D office. What it should not build: an API proxy, automatic credential rotation, cookie scraping, or its own worktree/PTY orchestration.

## 7. Improvement backlog

Merged from the product lane and corrected by round two. QW = quick win.

| #   | Item                                                                                                                       | Impact   | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | v1.2.16 hotfix: terminal-opener injection (H1) and settings.json clobber (H2) — QW                                         | Critical | S      |
| 2   | Statusline tee that chains the existing statusline and writes per-config-folder readings; parse epoch seconds and decimals | High     | M      |
| 3   | Sync health panel that explains every empty or stale reading                                                               | High     | S      |
| 4   | Sessions from `<root>/sessions/*.json` for every config root, ps as fallback                                               | High     | M      |
| 5   | Remove phantom processes, the promo checker, the fake weekly bar and dead settings — QW                                    | Medium   | S      |
| 6   | Real typecheck, ESLint flat config, CI, LICENSE, untrack the xcarchive — QW                                                | High     | S      |
| 7   | Electron 44 with sandbox, fuses, strict CSP and validated IPC                                                              | High     | M      |
| 8   | Codex sessions and Codex limits from rollouts                                                                              | High     | M      |
| 9   | Account model: default login, ClaudeWatch folders, Orca mirror, de-duplicated                                              | High     | L      |
| 10  | "New session as account X" for ClaudeWatch folders; hand-off to Orca for Orca accounts                                     | High     | M      |
| 11  | Live events through a Claude Code plugin (async command hooks to a unix socket)                                            | High     | M      |
| 12  | Notifications: needs permission, waiting for you, 90%, limit reached, will hit before reset                                | High     | M      |
| 13  | Burn-rate forecast and an advisory "use account B next" chip                                                               | Medium   | M      |
| 14  | Limit history store                                                                                                        | Medium   | M      |
| 15  | Widget with per-widget account and provider choice                                                                         | Medium   | M      |
| 16  | Menu bar title modes ("!2 71%") — QW                                                                                       | Medium   | S      |
| 17  | Onboarding checklist and an in-app data policy                                                                             | Medium   | M      |
| 18  | 3D agent office (sections 11 and 15)                                                                                       | High     | XL     |
| 19  | Compatibility fixtures for every external format, run against each Claude Code, Codex and Orca release                     | Medium   | M      |
| 20  | Windows and Linux: decide whether to freeze them at 1.2.x or keep them                                                     | Low      | S      |

## 8. The 3D agent office: prior art

| Project                     | Engine               | Live data                                                                        | Licence, stars               |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| Pixel Agents                | 2D Canvas, React 19  | 12 Claude hooks to a local server, transcript fallback, typed provider interface | MIT, 9.6k                    |
| claude-office (paulrobello) | 2D PixiJS + FastAPI  | Claude hooks, WebSocket; already has floors = groups of repos                    | MIT, 558                     |
| Vibecraft                   | 3D Three.js          | bash hook posts to a localhost server                                            | MIT, 1.4k                    |
| Claw3D                      | 3D React Three Fiber | OpenClaw gateway only                                                            | MIT, 2.3k                    |
| Star-Office-UI              | 2D pixel             | agent pushes its own state                                                       | Code MIT, art non-commercial |

No project combines 3D, Claude plus Codex, Orca awareness and accounts. Users of these projects mostly ask for more providers and a standalone app, not more decoration. Lessons worth keeping: normalise hooks and transcripts into one event schema (Pixel Agents' provider contract is the best MIT template); "turn done" is not "needs you"; drop prompt text you do not use.

## 9. Verified facts and corrections

Round two re-derived the load-bearing claims. These corrections supersede round one.

| Claim                                                   | Verdict                   | Correction                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orca isolates nothing per config dir                    | Confirmed for 1.4.220/224 | `main` has per-account folders (#26801); design for both models                                                                                                                                                                                 |
| `orca account list --json` gives every account's limits | Partly                    | Active account null while Orca panes are live; inactive accounts only after the Accounts pane is opened                                                                                                                                         |
| An outside app cannot switch Orca's Claude account      | Partly                    | The owner-scope RPC can; the CLI cannot until PR #26870. ClaudeWatch will use neither in v1                                                                                                                                                     |
| Orca's streaming RPC works over the unix socket         | Refuted                   | Streaming needs a paired device token on the WebSocket. Poll `session.tabs.listAll` or the CLI                                                                                                                                                  |
| Orca panes have no `CLAUDE_CONFIG_DIR`                  | Confirmed                 | Changes with the per-account release                                                                                                                                                                                                            |
| The weekly bar shows real tokens                        | Refuted                   | It is a local hook's 2,000-tokens-per-tool-call estimate                                                                                                                                                                                        |
| Legal page bans third-party token use                   | Confirmed (quote)         | It does not name the usage endpoint or refresh; the Consumer Terms "automated or non-human means" clause and a new Usage Policy clause (effective 2026-11-12) against "services that route requests through consumer subscriptions" cover those |
| HTTP hooks work on every event                          | Refuted                   | Not on `SessionStart` or `Setup`                                                                                                                                                                                                                |
| Plugins can ship a statusline                           | Refuted                   | Only `agent` and `subagentStatusLine`                                                                                                                                                                                                           |
| A local plugin marketplace loads in place               | Refuted                   | It is copied into a versioned cache                                                                                                                                                                                                             |
| `procStart` can be compared with `ps lstart`            | Partly                    | Use `LC_ALL=C TZ=UTC ps -o lstart=` and normalise whitespace                                                                                                                                                                                    |
| three r186 removed PCFSoftShadowMap                     | Partly                    | Still exported, warns and falls back to PCF                                                                                                                                                                                                     |
| Quaternius assets are CC0                               | Refuted                   | QAL v1.0 bans redistributing them; KayKit and Kenney are CC0                                                                                                                                                                                    |
| Rocketbox was archived recently                         | Refuted                   | Last push 2022-10-02, about 3.9 GB, MIT, 471 clips, no typing clip                                                                                                                                                                              |
| `node:sqlite` works in Electron                         | Unverified                | Electron issues #47671 and #45532 show regressions; prototype 4 checks                                                                                                                                                                          |

## 10. Architecture: accounts, providers, limits

### What "switch account" means

| Account kind       | Where it lives                                                           | What "switch" does                                                                                                                                                           | Limits shown                                            |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Default login      | `~/.claude` (or `~/.codex`)                                              | Nothing to switch; it is what plain `claude` uses                                                                                                                            | Statusline tee, matched cache                           |
| ClaudeWatch folder | One `CLAUDE_CONFIG_DIR` / `CODEX_HOME` per account, owned by ClaudeWatch | "New session as X": opens a terminal in a chosen project with that env; affects nothing else                                                                                 | Statusline tee from its sessions, its own matched cache |
| Orca-managed       | Orca                                                                     | "Switch default in Orca…": brings Orca's switcher forward, with a warning that this changes every Claude session on the Mac. Later, Orca's own CLI once #26870 ships, opt-in | Orca's cached numbers with their age                    |

The same person in ClaudeWatch and Orca is one card: match on `accountUuid`, else lowercased email plus organisation UUID, never email alone. A plain-terminal shell function (`cw claude --as work`) makes the folder switch one command.

Things the folder model must handle: each folder needs its own `claude` login; every folder has its own workspace-trust prompts (N accounts × M projects); hooks, skills, plugins and `CLAUDE.md` must be provisioned from `~/.claude` (copy `settings.json`, link directories, never copy credentials or sessions); the folder location is permanent because the Keychain item is keyed to a hash of its path.

### Core design

```ascii
 Sources (read-only, no tokens)          bridge utilityProcess (owns truth)          consumers
+--------------------------------+      +-------------------------------+      +--------------------+
| <root>/sessions/*.json (roots) |----->| ingest adapters               |      | main: tray, notify |
| statusline tee spool files     |----->|  -> allowlist projection      |----->| popover, dashboard |
| plugin hooks -> unix socket    |----->|  -> normaliser (AgentEvent)   |      | widget stats.json  |
| Codex rollouts / app-server    |----->|  -> pure reducer -> Snapshot  |----->| Office window      |
| orca CLI --json (read-only)    |----->|  -> labels-only event log     |      | (later) loopback   |
+--------------------------------+      +-------------------------------+      +--------------------+
```

Decisions (the red team's resolution of conflicts between the core and office lanes):

- **One process owns truth**: an always-on `bridge` utilityProcess runs ingest, the reducer and the event log; main consumes its patches for the tray, notifications and widget. Popover, widget and office all read the same snapshot, so counts always agree.
- **One contract**, frozen before parallel work starts, in `src/shared/`: `AccountRef`, `SessionRef`, `LimitWindow` (kind derived from window minutes, `usedPercent`, `resetsAtMs`, source, `fetchedAtMs`, confidence live/cached/extrapolated/unknown), `AgentEvent`, `Snapshot` (versioned), `SourceHealth`, `FeedMessage`, `AgentView`, and one `projectKey` function (canonical git common dir, merged with Orca `repoUuid`).
- **Statusline**: a POSIX `sh` tee reads stdin once (with a sentinel so trailing newlines survive), writes `<CLAUDE_CONFIG_DIR>` plus the payload atomically to a spool file, then runs the user's original command with byte-identical stdin and returns its exit code. The original command is stored outside `settings.json`. Opt-in, with one-click undo.
- **Live events**: a ClaudeWatch Claude Code plugin whose `hooks.json` calls a stable `~/.claudewatch/bin/cw-hook.sh` (so app updates update the hook), as async command hooks posting to a 0600 unix socket with a 1 s cap, always exiting 0.
- **Codex**: rollout tail by default, deduped by inode; `app-server` only on an explicit Refresh.
- **IPC**: one `snapshot:update` push plus `snapshot:get`, and a batched `events:batch` channel for the office. The four existing push channels go.
- **History**: `node:sqlite` after the Electron 44 upgrade if prototype 4 proves it works in the packaged app, otherwise `better-sqlite3`.
- **Widget**: all new Swift fields optional; move to an App Intent configuration for per-widget account choice.

## 11. Architecture: the agent office

### World model (owner decision: floor = project)

| Office concept | Real thing                                                  | Key                                                    |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Building       | This Mac                                                    | —                                                      |
| Floor          | Project (git root)                                          | canonical repo root; Orca `repoUuid` merges duplicates |
| Wing           | Worktree                                                    | Orca worktree id or git worktree path                  |
| Office         | Top-level session (Claude session, Codex thread, Orca pane) | session id, liveness by pid + UTC procStart            |
| Guest desks    | Subagents (up to 4–6, then a team room / bullpen)           | `agent_id` from `SubagentStart`                        |
| Character look | Provider (uniform) and account (lanyard / desk plate)       | —                                                      |
| Lobby board    | Usage meters per account                                    | Snapshot limits                                        |

Layout is deterministic and persisted, so an agent keeps its desk and character across restarts. With 60 agents only the focused floor is 3D; a 2D cross-section (the elevator panel) shows counts and attention badges for the others.

### Live state to behaviour

| Real signal                              | What the character does                         | Marker                  |
| ---------------------------------------- | ----------------------------------------------- | ----------------------- |
| `SessionStart` / new registry file       | Walks out of the elevator, sits                 | —                       |
| `PreToolUse` Read/Grep/Glob              | At the filing cabinet                           | violet (working)        |
| Edit/Write                               | Types at the desk                               | violet                  |
| Bash, tests                              | At the server rack; lamp green or red on result | violet                  |
| `SubagentStart`                          | An intern arrives at a guest desk               | —                       |
| `PermissionRequest` / registry `waiting` | Stands, hand raised                             | red, raised hand, sound |
| `Notification(idle_prompt)`              | Turns to camera, amber flag                     | amber "?"               |
| `StopFailure(rate_limit)`                | At the vending machine with a reset countdown   | grey hourglass          |
| `PreCompact` / `PostCompact`             | Feeds the shredder                              | —                       |
| `Stop`                                   | Drops a report in the out-tray                  | blue check, then idle   |
| `SessionEnd` / pid gone                  | Packs up and leaves; lights dim                 | —                       |

Rules that keep it truthful: minimum dwell per state and coalescing of bursts (tool calls often take tens of milliseconds); pair tools on `tool_use_id`; `Stop` is not "needs you"; `StopFailure` and `PostCompact` also end turns; ignore `ORCA_*` env when `CLAUDE_JOB_DIR` is set; idle "life" (coffee, stretching) never hides an attention state.

### Office pipeline

```ascii
 bridge utilityProcess                 Office BrowserWindow (lazy, sandboxed, destroyed on close)
+--------------------------+  Message  +-----------------------------------------------------+
| reducer -> Snapshot      |  Port     | src/office/sim  (pure TS, 10 Hz focused floor,      |
| patches 4 Hz, attention  |---------->|                  1 Hz others; layout, paths, FSM)   |
| immediately              |           |        | AgentView {floor, room, slot, activity,    |
+--------------------------+           |        v           attention, provider, account}   |
                                       | R3F scene (three r186, WebGPU + WebGL2 fallback)    |
                                       | DOM HUD: lobby meters | attention queue | elevator  |
                                       | inspector + jump to terminal | List view fallback   |
                                       +-----------------------------------------------------+
```

### Engine and look (fidelity lane)

| Layer        | Choice                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer     | three 0.186 with @react-three/fiber 9.8 and a minimal drei 10.7 subset; WebGPURenderer with TSL materials, WebGL2 backend as fallback; the slice measures both                                    |
| Prerequisite | Electron 44 (Chromium 152); pin React ~19.3 (fiber 9.8 requires React below 19.4)                                                                                                                 |
| Characters   | Microsoft Rocketbox (MIT): 115 avatars, LODs 10k/5k/2.5k/500 triangles, about 12 shared bases with colour-mask variation                                                                          |
| Animation    | One canonical skeleton; Rocketbox's sit, talk, phone, cheer and walk clips; typing, reading, thinking and hand-raise authored or AI-drafted and cleaned in Blender; everything retargeted offline |
| Lighting     | Baked AO per object, lightmaps baked in Blender per room template, one shadowed key light, GTAO, HDRI environment, TRAA                                                                           |
| Camera       | Sims 3 style orbit (tilt clamp 25–70°), three zoom bands, walls up / cutaway / down                                                                                                               |
| Crowd        | Only the focused floor mounted; at most 24 agents at full animation rate, then 15 Hz, then 5 Hz or frozen                                                                                         |
| Power        | 30 fps focused, 10–15 visible but blurred, 0 hidden; one tier lower on battery; DPR ≤ 1.5; low-power GPU                                                                                          |
| Assets       | Not in the public repo: a separate art repo, packs fetched by hash; core pack MIT/CC0 only, paid assets in a private pack                                                                         |
| Hosting      | In-app window first; a loopback web page later, read-only, behind the same feed                                                                                                                   |

Budgets for the focused floor: ≤ 600k triangles including shadow casters, ≤ 300 draw calls, ≤ 256 MB GPU textures, renderer process ≤ 600 MB, L2 assets ≤ 150 MB on disk.

### The honest part about "close to Sims 3"

Rendering is not the limit. Content is. There is no free typing animation anywhere, and typing is the most important clip for a "watch agents work" product. Rocketbox looks semi-realistic and early-2010s; whether that reads as "close to Sims 3" is your call at the slice A/B. The fallback ladder:

| Level              | What it looks like                                                                               | When                          |
| ------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| L0 graybox         | Capsules on real floors, live states, elevator, inspector                                        | Always built; proves the data |
| L1 real characters | Rocketbox cast, blended seat-aligned animation                                                   | Always built                  |
| L1.5               | L1 plus Kenney/KayKit furniture, baked AO, one shadow light: clean but not charming              | Fallback if L2 is not funded  |
| L2 Sims 3 look     | PBR, baked lighting, about 40 clips, 40–60 props; passes a blind A/B against Sims 3 office shots | Needs about $4–12k of art     |
| L3 Sims-like life  | Idle autonomy, interaction animations, replay, optional build mode                               | About $3–10k more             |

## 12. Security model

Credential posture (security lane, with veto):

| Tier                                                         | Verdict                                                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| T0: never read any token; documented and local files only    | The only default                                                                                                 |
| T1: read an access token to call a usage endpoint            | Prohibited (veto V1)                                                                                             |
| T2: refresh OAuth tokens                                     | Prohibited                                                                                                       |
| T3: swap the default credential between accounts, Orca-style | Prohibited (veto V4)                                                                                             |
| T4: delegate the Claude switch to Orca                       | Only through Orca's signed CLI once #26870 ships, opt-in, with a host-wide warning. The RPC route is vetoed (V3) |

Terms, as quoted by the docs verifier:

| ClaudeWatch design choice                                       | Verdict                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read the statusline JSON, session files, transcripts            | Allowed                                                                                                      |
| Plugin hooks                                                    | Allowed                                                                                                      |
| Launch unmodified `claude` with `CLAUDE_CONFIG_DIR` per account | Allowed and explicitly endorsed                                                                              |
| Read the Keychain token and call `/api/oauth/usage`             | Grey, leaning prohibited ("may not collect, store, or intermediate Claude.ai credentials or session tokens") |
| Refresh tokens or swap credentials                              | Prohibited in effect                                                                                         |
| Rotating accounts to get around limits                          | Grey ("usage limits ... assume ordinary, individual usage"); keep suggestions advisory                       |
| Codex rollouts and `app-server`                                 | Allowed                                                                                                      |
| `wham/usage` with a stored ChatGPT token                        | Grey, leaning prohibited                                                                                     |

Release-blocking requirements (selected from 40; full list in the security lane output):

- SEC-1/2/3: no credential store opened, no request to Anthropic or OpenAI hosts, no writes to `~/.claude.json` or any credential, no `claude auth` or `claude agents` calls. The only exception to SEC-1 is Orca's token-free `oauth-account.json`, allowlisted by exact name (the red team found the original wording blocked the offline Orca mirror).
- SEC-7/8: never read `orca-runtime.json` or open Orca's sockets; run the Orca CLI only from a codesign-verified `Orca.app`, with `execFile`, a fixed argv and a scrubbed environment.
- SEC-9/30: validate every external JSON with a strict schema and keep only allowlisted fields at ingress. Prompts, assistant text, tool inputs and outputs never get past ingress; file basenames are opt-in.
- SEC-12/13/14: hooks are async command hooks to a 0600 unix socket, never HTTP, never a TCP listener; scripts never parse payloads into a shell.
- SEC-17: every `settings.json` write aborts if the file does not parse, writes atomically with a backup and a compare-and-swap.
- SEC-19/20/21/22/27: supported Electron major, sandboxed windows from one factory, navigation locks, sender-checked and schema-validated IPC, fuses.
- SEC-23: `terminal:open` passes paths as argv, never as shell or AppleScript source.
- SEC-29: the optional web page binds 127.0.0.1 only, pins Host and Origin, uses a fragment token exchanged for an HttpOnly cookie, and has read-only routes.
- SEC-11: a canary secret and canary prompt placed in a test session must never appear in any ClaudeWatch file, log or IPC message.

## 13. UX

One job per surface:

| Surface                    | Job                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Menu bar title             | Does anything need me, and how close is my default login to a limit: `!2  71%`, or `⧗ 15:40` when limited. Monochrome glyphs |
| Popover (grows to 360×560) | Needs-you strip, account cards for Claude and Codex, sessions by project                                                     |
| Dashboard                  | Manage accounts, sessions, history, data sources                                                                             |
| Settings                   | Configuration and sync health (8 sources, each with a plain-words reason and one fix button)                                 |
| Widget                     | Headroom for the accounts you choose, per widget                                                                             |
| Office                     | Spatial awareness and triage of the fleet, with replay and a List view fallback                                              |

```ascii
+------------------------------------------+
| ! 2 need you          [ Next  > ]        |
|------------------------------------------|
| Claude  me@a.test      * DEFAULT  Max 20x|
|  5-hour  [#######.....]  58%  resets 3h  |
|  Weekly  [#########...]  81% ^ live      |
| Claude  personal       Orca              |
|  Weekly  [####........]  33%  as of 2h   |
| Codex   pro            ~/.codex          |
|  Weekly  [#...........]   1%  as of 4m   |
|  -> Use "personal" next (48 pts more)    |
|------------------------------------------|
| ClaudeWatch    > store.ts   Working      |
| PropApp        ? asked a question        |
|------------------------------------------|
| Dashboard   Office   Settings      Quit  |
+------------------------------------------+
```

Rules that apply everywhere:

- Every limit number shows its source and age. Null is never drawn as 0%. Each reading is in one of nine states: live, cached, old, extrapolated, unknown, error, fetch rate-limited, not signed in, no plan limits.
- Severity bands are the same on every surface: below 75% normal; 75–89% amber with ▲; 90–99% red with !; limited shows ⧗ and the reset time. The percentage is always printed, so colour is never the only signal.
- Seven session states (Working, Needs permission, Waiting for you, Done, Error, Limited, Idle) share one attention queue, ordered by wait time. "Next" always jumps to the head.
- The "use account B next" chip appears only above 75% or when a limit is forecast, needs at least 25 points more headroom on the other account, and never sends a notification.
- Contrast fixes: `#636366` caption text on `#0E0E10` is 3.2:1 and the accent `#7C5CFC` is 4.0–4.4:1. Both fail WCAG AA for small text and must change.
- HTML mock-ups with the project's tokens come before building the popover, Accounts view, Sync health, onboarding and the Office HUD.

## 14. Red team: what must be fixed in the plan itself

The design lanes disagreed in ways that would have split the build. Resolved here:

| Conflict                                                                                                                   | Resolution                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Two cores (main vs bridge), two `AgentEvent` unions, two `AccountRef` types, three `SourceHealth` shapes, two project keys | One contract and one process model, frozen in a 1–2 day gate before parallel work (Wave 3)                        |
| Hook transport: loopback TCP vs unix socket                                                                                | Unix socket (SEC-12)                                                                                              |
| Statusline: background socket forward vs spool file                                                                        | Spool file; SEC-18 rewritten to match                                                                             |
| Where owned account folders live (three answers)                                                                           | Decide once before the first login (section 15, question 3)                                                       |
| UX shows prompt text and commands; security drops them at ingress                                                          | Labels only by default; any opt-in is captured before projection and kept in memory                               |
| Office assets inside vs outside the signed asar                                                                            | Hash-manifested pack outside asar; SEC-25 amended (fuses protect code, not data)                                  |
| Attention queue membership and state colours differ between lanes                                                          | UX's queue (needs permission, waiting for you) wins; error and limit are counts. One colour table in the contract |

Five things to prototype before building, because the plan fails if they come out wrong:

1. **Statusline tee** (2–4 h): chained behind the real `gsd-statusline.js`; latency, byte-identical output, attribution by folder, background jobs.
2. **One owned config folder, plus 48 h of coverage logging** (3–5 h plus passive time): where `.claude.json` lands, Keychain item naming, trust prompts, and how often each of your 4 Claude accounts has a limit reading under 6 h old from token-free sources. This number settles question 1.
3. **Plugin hook bridge** (3–4 h): cached-copy updates, latency with the 19 existing PreToolUse handlers, ordering under parallel tools, version skew between 2.1.295 and 2.1.296 sessions.
4. **Electron 34 → 44** (6–10 h): sandbox on, fuses, `node:sqlite` in the packaged app, widget re-sign, notarisation, updater.
5. **Office vertical slice** (36 h, separate repo): one room, 3 Rocketbox characters, baked light, cutaway walls, a typing loop; measured on both backends on a base-model Air. Pass: GPU frame time ≤ 12 ms p95 at 30 fps, renderer ≤ 600 MB, energy below a playing YouTube tab, and you accept the look.

Other gaps the red team found: no uninstall path for the statusline, plugin and hooks; Windows/Linux builds would silently regress; no CI exists; release signing must move from the development provisioning profile to Developer ID distribution for the widget; and each Orca CLI poll cold-starts Orca's Electron binary, so the cost must be measured before polling every 10 s.

## 15. Build plan

### Decisions you need to make before the build

| #   | Question                                                                                                   | Recommended answer                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Accept "last known, as of" or "unknown" limits for idle Claude accounts, or reopen the token veto?         | Accept, and decide after prototype 2's 48 h coverage numbers                                                                                                 |
| 2   | "Switch" = start new sessions as an account (ClaudeWatch folders) plus hand-off to Orca for Orca accounts? | Yes; add a `cw claude --as <account>` shell function                                                                                                         |
| 3   | Where do ClaudeWatch account folders live? (permanent after first login)                                   | `~/Library/Application Support/ClaudeWatch/claude-accounts/<uuid>/home` (security lane); the alternative `~/.claude-<label>` is friendlier for shell aliases |
| 4   | Install the ClaudeWatch Claude Code plugin per config folder?                                              | Yes, opt-in on first run, one-click uninstall                                                                                                                |
| 5   | Statusline: chain behind `gsd-statusline.js`, replace, or skip?                                            | Chain                                                                                                                                                        |
| 6   | Windows and Linux: keep or freeze at 1.2.x?                                                                | Freeze at 1.2.x until the macOS rebuild ships                                                                                                                |
| 7   | Rocketbox look and art budget?                                                                             | Decide at the slice A/B; $0 through L1                                                                                                                       |
| 8   | Is the repo public long-term, and is the "Claude" name cleared?                                            | Assume public: add LICENSE now, keep paid art private, check trademark before a wider launch                                                                 |
| 9   | Web-page mode for the office in v1?                                                                        | No; in-app window first                                                                                                                                      |
| 10  | Should prompts ever appear in the inspector?                                                               | No                                                                                                                                                           |

### Work items

| Ticket              | Status                                                 | Source link                 | Conversation                                                                                                                            |
| ------------------- | ------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| none — needs filing | Researched; build not started; no PR                   | this session (no permalink) | "In Orca you can have multiple Claude accounts and you can just switch between them. I want the same concept with ClaudeWatch"          |
| none — needs filing | Researched; idle-account limits need decision 1; no PR | this session (no permalink) | "to check the usage limits for Claude for Codex The same way that we have in Orca"                                                      |
| none — needs filing | Backlog in section 7; no PR                            | this session (no permalink) | "I want you to post what improvements we can make to ClaudeWatch, a product"                                                            |
| none — needs filing | Researched; slice is the first step; no PR             | this session (no permalink) | "research how we can do an animated office, like a Sims game, a Sims 3 game, something like that, or any simulator game"                |
| none — needs filing | Hotfix found during research; no PR                    | this session (no permalink) | "We will be updating ClaudeWatch because there are a lot of new updates from Claude right now and I want to be in sync on this product" |

### Waves

```ascii
 W0  decisions + 5 prototypes (parallel: tee | owned folder | plugin | Electron 44 | office slice)
  |
 W1  repo hygiene, LICENSE, real typecheck + lint, CI, merge Electron 44        (1 owner)
  |
 W2  v1.3.0 make-true + hardening:  [main fixes] | [windows/CSP/IPC] | [Swift widget]
  |
 W3  CONTRACT FREEZE: src/shared types + bridge process model                  (1 owner, gate)
  |
 W4  [claude provider] [codex provider] [orca CLI] [hook plugin + ingest] [office world/sim] [UX mocks]
  |
 W5  assemble bridge, reducer, snapshot, preload, useSnapshot                  (1 owner)
  |
 W6  [accounts cockpit UI] [widget App Intent] [notifications/tray/queue] [limit history]
  |
 W7  office L0 graybox:  [window + main slice] | [scene + HUD + List view]
  |
 W8  office L1 characters:  [runtime] | [art pipeline]   + usefulness metrics
  |
 GATE  your A/B + week-3 usefulness (opens that lead to a jump >= 30%) --> L2 --> L3
```

The v1.2.16 hotfix (H1, H2) can ship before W0; it touches two files no wave depends on.

### Estimates

Senior engineer, hours with Claude Code | without.

| Phase                        | Scope                                                                                     | Estimate                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Hotfix v1.2.16               | Terminal-opener argv, atomic settings writer, tests                                       | 4h with Claude \| 10h without                     |
| W0                           | 5 prototypes and the decisions                                                            | 55h with Claude \| 128h without                   |
| W1                           | Hygiene, CI, Electron 44 merge                                                            | 12h with Claude \| 30h without                    |
| W2                           | v1.3.0 make-true and hardening                                                            | 45h with Claude \| 110h without                   |
| W3                           | Contract freeze                                                                           | 8h with Claude \| 20h without                     |
| W4–W6                        | Providers, accounts, Orca bridge, live events, cockpit UI, widget, notifications, history | 165h with Claude \| 400h without                  |
| **Cockpit subtotal**         | Everything except the office                                                              | **289h with Claude \| 698h without**              |
| W7 (L0)                      | Event bridge for the office, headless sim, graybox building                               | 100h with Claude \| 260h without                  |
| W8 (L1)                      | Characters and animation pipeline                                                         | 95h with Claude \| 230h without                   |
| Office UX                    | IA, HUD, visual language, usefulness metrics                                              | 32h with Claude \| 70h without                    |
| **First full ship**          | Cockpit + live office with real characters                                                | **516h with Claude \| 1,258h without**            |
| L2                           | Sims 3 look (art-bound)                                                                   | 260h with Claude \| 480h without, plus $4–12k art |
| L3                           | Sims-like life and polish                                                                 | 240h with Claude \| 520h without, plus $3–10k art |
| Web-page mode                | Optional                                                                                  | 26h with Claude \| 64h without                    |
| **Total (without web mode)** |                                                                                           | **1,016h with Claude \| 2,258h without**          |

Productivity multiplier about 2.2x (55% of hours saved). It is closer to 2.4x through L1 and lower for L2/L3, where most hours are Blender art and animation. Treat W2's hardening, owned-folder provisioning, L1 characters and L2 art as the items most likely to run 2–3x over; re-estimate after W0.

## Appendix: method

- Round one: 8 parallel read-only lanes (Orca accounts; Orca limits and usage; Orca integration surface; ClaudeWatch audit; Claude Code and Codex data surfaces; product landscape; 3D tech; office prior art and design). 179 findings, 162 marked verified.
- Round two: 2 adversarial verifiers (13 account/Orca claims, 11 docs/terms claims), a Sims 3-fidelity lane, 4 design lanes (core, office, security, UX), and a red-team critic that spot-checked 16 claims.
- Sources: the ClaudeWatch source; the Orca source at v1.4.224 and its public `main`; the live machine, reading only key names for any file that can hold a secret; primary web sources (code.claude.com docs and changelog, anthropic.com/legal, OpenAI and Codex docs, npm, GitHub).
- No credentialed network request was made and no token value was printed or stored. Three agents briefly wrote scratch files under `/tmp` and reported it; those are cleaned up with the research clone.
