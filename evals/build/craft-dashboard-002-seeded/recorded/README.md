# Recorded build — craft-dashboard-002-seeded

Captured 2026-08-06 from a blind run against the skill at CLI v1.0.14 / ui-craft-mcp 0.8.2,
in a fresh session given only the prompt — no checklist, no hint about what is scored.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed. That is what makes the scorers testable in CI without spending an
agent run, and it is why the fixtures that fail are kept failing rather than patched.

The Tier-1 re-measure fixture. The workspace ships `.ui-craft/brief.md`, `.ui-craft/tokens.md`
and a CSS token spine, so this is the only eval that can ask whether an existing brief changes
the output — greenfield cannot, because the files those references teach you to read do not
exist there.

The sharpest checks are the two learned constraints from the seeded brief: no coloured delta
pills, and the sidebar stays light. Both contradict the skill's own defaults, so honouring
them is only possible by having read that brief.

Expected verdict: passes everything about the brief — both learned constraints honoured, the
existing token spine used, no raw hex, no dark-mode variants — and fails the Craft Read check,
like every other surface measured in this round. That combination is the finding: the brief
changed the output without the agent narrating anything about it.
