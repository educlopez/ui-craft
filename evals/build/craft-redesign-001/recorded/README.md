# Recorded build — craft-redesign-001

Captured 2026-08-06 from a blind run against the skill at CLI v1.0.14 / ui-craft-mcp 0.8.2,
in a fresh session given only the prompt — no checklist, no hint about what is scored.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed. That is what makes the scorers testable in CI without spending an
agent run, and it is why the fixtures that fail are kept failing rather than patched.

The only seeded fixture with a before/after story: the workspace started as a dated 2019
landing (purple-to-cyan gradient, uppercase headings, emoji icons, "Learn more" twice) that
scored 2 detector errors and 11 findings.

Expected verdict: everything preserved — heading levels, internal routes, all three pricing
tiers, the brand hex — and the dated tells gone. It fails one check, "states what it will
preserve", because the build audited the site properly but never wrote the preserve list down.
