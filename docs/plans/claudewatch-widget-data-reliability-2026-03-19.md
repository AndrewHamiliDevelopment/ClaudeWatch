# ClaudeWatch Widget Data Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the macOS widget refresh more reliably by fixing timestamp compatibility, serializing widget writes, and rewriting widget data when usage bootstrap completes.

**Architecture:** Keep the existing WidgetKit + shared snapshot approach, but harden the producer side instead of redesigning the whole data flow. The Electron app remains the single writer of `stats.json`; we add a small widget sync coordinator, serialize writes in the writer, and emit a usage-driven refresh so the widget is not stuck with empty startup usage.

**Tech Stack:** TypeScript, Vitest, Electron main process, Swift WidgetKit

---

**Total:** 3.3h with Claude | 10.9h without Claude
**Productivity Multiplier:** 3.3x
**Time Saved:** 7.6h (69.7%)

### Task 1: Lock writer behavior with failing tests

Task: 0.8h with Claude | 2.5h without

**Files:**

- Modify: `src/main/widget-stats-writer.test.ts`
- Create: `src/main/widget-stats-writer-coordination.test.ts`
- Modify: `src/main/usage-stats.test.ts`
- Create: `src/main/widget-sync.test.ts`

**Step 1: Write the failing tests**

- Add a test proving widget timestamps are ISO8601 without fractional seconds.
- Add a test proving concurrent writer calls serialize instead of racing rename operations.
- Add a test proving `UsageStatsReader` can notify listeners after a fresh read.
- Add a test proving widget sync rewrites widget data when usage updates arrive.

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/main/widget-stats-writer.test.ts src/main/widget-stats-writer-coordination.test.ts src/main/usage-stats.test.ts src/main/widget-sync.test.ts`

Expected: timestamp/coordination/usage-sync tests fail for the current implementation.

### Task 2: Fix producer-side widget coordination

Task: 1.4h with Claude | 4.6h without

**Files:**

- Modify: `src/main/widget-stats-writer.ts`
- Modify: `src/main/usage-stats.ts`
- Create: `src/main/widget-sync.ts`
- Modify: `src/main/index.ts`

**Step 1: Implement minimal writer hardening**

- Serialize `WidgetStatsWriter.write()` calls.
- Make temp file names unique enough to avoid collisions.
- Emit `updatedAt` in a Swift-friendly ISO8601 format without fractional seconds.

**Step 2: Implement usage-driven widget refresh**

- Add a minimal `UsageStatsReader` subscription API.
- Create a small widget sync helper that writes on tracker updates and usage updates.
- Wire `src/main/index.ts` through the helper instead of inline widget writes.

**Step 3: Run focused tests**

Run: `npm test -- src/main/widget-stats-writer.test.ts src/main/widget-stats-writer-coordination.test.ts src/main/usage-stats.test.ts src/main/widget-sync.test.ts`

Expected: PASS.

### Task 3: Harden the Swift side against stale-text edge cases

Task: 0.4h with Claude | 1.4h without

**Files:**

- Modify: `widget/ClaudeWatchWidget/Models/WidgetStats.swift`
- Modify: `widget/ClaudeWatchWidget/Views/LargeWidgetView.swift`

**Step 1: Make stale parsing defensive**

- Add a fractional-seconds-capable ISO8601 parsing fallback.
- Clamp impossible staleness values before formatting the large widget footer.

**Step 2: Run available verification**

Run the JS/TS suite again plus typecheck, then manually inspect Swift file consistency.

### Task 4: Verify and review

Task: 0.7h with Claude | 2.4h without

**Files:**

- Verify only

**Step 1: Format touched files**

Run: `npx prettier --write "src/main/widget-stats-writer.ts" "src/main/widget-stats-writer.test.ts" "src/main/widget-stats-writer-coordination.test.ts" "src/main/usage-stats.ts" "src/main/usage-stats.test.ts" "src/main/widget-sync.ts" "src/main/widget-sync.test.ts" "src/main/index.ts"`

**Step 2: Run full verification**

Run: `npm test && npm run typecheck`

Expected: all tests pass, typecheck passes.

**Step 3: Harsh review**

- Re-check for remaining bottlenecks: no WidgetKit reload trigger, packaged entitlement verification still missing, promo-only refresh still not proactive.
