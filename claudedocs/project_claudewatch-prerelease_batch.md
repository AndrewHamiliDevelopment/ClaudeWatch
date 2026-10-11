# ClaudeWatch pre-release batch — ledger (opened 2026-10-11)

Repo: `theangeloumali/ClaudeWatch` (item 7 also touches `theangeloumali/zkidz-claude-team`). Source of every item: Angelo's message in the session, 2026-10-11. No tracker ticket exists for any of them; open issues on the repo: 0.

Framing in his words: "You have fewer issues that we need to do before we are able to release this." … "I want to dispatch a team of agents to research , and assess overall all of the items on here and I want you to also dispatch a team of agents that will execute this in parallel and build this autonomously"

## Intake (verbatim, never re-derived)

| Id | Ticket | Status | Source link | Conversation |
| --- | --- | --- | --- | --- |
| B0 | none — needs filing | intake | session message, 2026-10-11 | "The zooming, the panning, zooming in, zooming in and zooming out, and the panning in and panning out should also be optimized and smoothened out" |
| B1 | none — needs filing | intake | session message, 2026-10-11 | "Where is the button for us to start the office? Do we already have that on the CloudWatch main frame?" |
| B2 | none — needs filing | intake | session message, 2026-10-11 | "I want you to overhaul and redesign the whole CloudWatch aggressively. You can use UI/UX Pro Max. Coordinate with Codex for possible redesign choices. As much as possible we need to overhaul the design for that. We need it to be better." |
| B3 | none — needs filing | intake | session message, 2026-10-11 | "On the office we need to know how many contacts or how many tokens the company or the office has used. For example on a project basis how many tokens have they used? We also need to know how many agents and how many tokens the agent has already used" |
| B4 | none — needs filing | intake | session message, 2026-10-11 | "The ability for us to focus on the exact pane, terminal, or tab to Orca, because this is strictly integrating with Orca. We need to properly implement it correctly." |
| B5 | none — needs filing | intake | session message, 2026-10-11 | "I want to also introduce a set of themes: also each office can have a configurable theme instead of everything are the same a. code geass inspired team - full mecha of code geass and some significant characters like lelouch, kallen, shirley, zero, suzaku and other interesting characters b. gundam team c. a nature chill inspired theme" |
| B6 | none — needs filing | intake | session message, 2026-10-11 | "We need to also make sure we track all of the token usage, overall token usage for each of the accounts in Claude. For example in Orca, you can have multiple Claude accounts. If possible every authenticated account should also be watched here." |
| B7 | none — needs filing | intake | session message, 2026-10-11 | "Also I want you to make sure that this is properly wired with ZKidz claude Team. Even without Cloud Watch I should be able to use it with just the ZKidz claude team repo" |

## Carried in from the command-center change

- Cleanup pass on the command-center diff (reuse, simplification, efficiency, altitude), applied on `feature/prerelease-batch` (7dab6ce): numeric ranges moved next to the settings shape check so the stored file is range-checked on read too; window-bounds helpers simplified. Skipped on purpose: the tray popover keeps its own position-save timer (it saves a position only while pinned), and the explicit quitting flag before an update install stays (that path closes windows before `before-quit`).
- B1 answered from the code: no Office entry exists on the dashboard or the popover; only the tray menu item (`src/main/tray.ts:279`) and the start-up switch.

## Scope probe

Pending: research workflow (one reader per item, adversarial checks on the claims the build depends on, three redesign directions plus Codex's, a completeness critic).

## Grill answers

Pending.

## Batch plan

Pending.
