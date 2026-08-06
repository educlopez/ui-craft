# Recorded build — craft-auth-001

Captured 2026-08-06 from a blind run against the skill at CLI v1.0.14 / ui-craft-mcp 0.8.2,
in a fresh session given only the prompt — no checklist, no hint about what is scored.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed. That is what makes the scorers testable in CI without spending an
agent run, and it is why the fixtures that fail are kept failing rather than patched.

Expected verdict: FAILS the Craft Read checks. This build loaded the skill and read
`recipe-auth`, `craft-intent` and `themes` before writing — the recipe gate works — but wrote
95 characters of preamble and never emitted the Craft Read line. Kept failing: it is the
regression fixture for whatever eventually makes that emission reliable.
