# Recorded build — craft-portfolio-001

Captured 2026-08-06 from a blind run against the skill at CLI v1.0.14 / ui-craft-mcp 0.8.2,
in a fresh session given only the prompt — no checklist, no hint about what is scored.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed. That is what makes the scorers testable in CI without spending an
agent run, and it is why the fixtures that fail are kept failing rather than patched.

Expected verdict: FAILS the Craft Read checks, same as the auth fixture — 41 characters of
preamble, straight to writing. Two surfaces failing the same gate in one round is what turned
"the Craft Read is inconsistent" from an impression into a measurement.
