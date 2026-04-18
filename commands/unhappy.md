---
description: State-first design pass. Generate or audit the UI's loading, empty, error, partial, conflict, and offline states — before the happy path.
argument-hint: "[file or component path]"
---

Design every non-happy state for the UI at `$ARGUMENTS`. Load the `ui-craft` skill and read `references/state-design.md`.

**Step 1 — Inventory.** List every data source and interactive surface in the target. For each, enumerate its states:

| Surface | idle | loading | empty | error | partial | conflict | offline |
|---------|------|---------|-------|-------|---------|----------|---------|

Mark each cell as **designed** (exists in code), **missing** (must add), or **N/A** (not applicable — e.g., a read-only view has no conflict state).

**Step 2 — Fill the missing states.** For each missing state, either stub it inline or add a follow-up task comment. Use `references/state-design.md` for:
- Skeleton sizing (match final layout, 200ms delay, 5s upper bound)
- Empty-state copy (why empty + next action + visual)
- Error-state contract (specific cause + one-click recovery + support ID)
- Offline handling (queue writes + reconcile on reconnect)

**Step 3 — Audit the happy path.** Flag every spot where the happy path assumes resource presence without checking. Fix with early-returns, state guards, or discriminated-union state handling. Booleans like `isLoading && !error && data` that allow impossible states are findings — refactor to a proper state machine or reducer.

**Step 4 — Optimistic UI + reconciliation.** For offline-likely actions (saves, sends, edits, toggles), implement optimistic UI with reconciliation on reconnect. Queue writes locally. Surface any rejected writes — never swallow them.

**Knob gating (CRAFT_LEVEL):**

| CRAFT_LEVEL | Required states to stub |
|-------------|-------------------------|
| ≤ 4 | idle, loading, error |
| 5-7 | idle, loading, empty, error, success |
| 8+ | all six — add partial, conflict, offline |

If `CRAFT_LEVEL` is unknown, default to 7.

**Output:** edit the code directly. After each file, print the Review Format table from SKILL.md:

| Before | After | Why |
| --- | --- | --- |
| no loading state on `<ProjectList>` | skeleton rows matching final layout, 200ms delay | prevents "is it broken?" perception; avoids CLS |
| generic "Error" toast | inline error with specific cause + retry + support ID | recoverability (heuristic 9) |

One row per state added. No full diffs.
