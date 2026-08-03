# Recorded build — craft-landing-001

Captured 2026-08-03 from a blind Track B1 run against ui-craft v0.8.0, in a fresh session
given only the prompt.

Frozen on purpose. A recorded build never drifts, so if a check changes verdict against it,
the **scorer** changed.

Expected verdict: FAIL on two checks, and both are the findings that produced v0.8.1 —
a 32-word hero subtext against a ≤20 limit, and a transcript that carries the right decisions
without ever emitting the Craft Read line. Kept failing deliberately: this is the regression
fixture for both fixes, and a fixture that records the miss is worth more than one that
records the fix.
