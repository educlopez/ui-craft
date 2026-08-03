# Recorded build — craft-dashboard-001

Captured 2026-08-03 from a blind Track A1 run against ui-craft v0.8.0, in a fresh session
that was given only the prompt — no checklist, no mention of Craft Read or signature bets.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed. That makes the scorers testable in CI without spending an agent run,
which is what keeps them honest between releases.

Expected verdict: the table checks FAIL. This build predates the `overflow-x` + sticky-header
rule reaching `dashboard.md` (shipped in ui-craft-mcp v0.8.1), and it is kept failing rather
than patched — a fixture that records the miss is worth more than one that records the fix.
