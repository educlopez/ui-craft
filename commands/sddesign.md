---
description: Full spec-driven pipeline — walks brief → tokens → shape → craft → converge → ship in one guided run. Writes `.ui-craft/spec.md`. Run when starting a net-new surface from scratch.
argument-hint: "[surface description]"
---

Run the spec-driven design pipeline for `$ARGUMENTS`. Load the `ui-craft` skill.

---

## ORCHESTRATE-ONLY RULE

This command **sequences existing phase commands**. It MUST NOT re-implement or duplicate any logic from them. Every composition rule, wireframe algorithm, craft rule, and convergence engine lives in the phase commands. This command contributes only:

1. Gate detection (does the artifact exist?)
2. Offer prompts (run phase X or skip?)
3. Progress reporting (the checklist)
4. Degraded-mode honesty (what was skipped and what that costs)

When in doubt: call the phase command, don't inline its steps.

---

## Progress Checklist

Print this at the start and update it after each gate resolves:

```
[ ] brief   [ ] tokens   [ ] spec   [ ] craft   [ ] converge   [ ] ship
```

Use `[✓]` for completed/skipped-with-artifact, `[>]` for the current gate, `[–]` for skipped-without-artifact (degraded).

---

## Pipeline Gates

### Gate 1 — Brief

Check: does `.ui-craft/brief.md` exist?

**If yes:** mark `[✓] brief`. Note that brief §6 learned constraints and the a11y/correctness floor are in effect for all downstream gates — they take precedence over any spec.md composition choice.

**If no:** offer to run `/brief` now.
- User confirms → run `/brief`. When it completes, mark `[✓] brief`.
- User declines → mark `[–] brief`. Note downstream impact: "no brief → craft will use skill defaults; composition will not be anchored to project principles."

### Gate 2 — Tokens

Check: does a token spine exist? (Look for CSS variables `--color-*`, `--font-*`, `--accent-*`, a Tailwind `theme.extend` with tokens, or a token file.)

**If yes:** mark `[✓] tokens`.

**If no:** offer to run `/tokens` now.
- User confirms → run `/tokens`. When it completes, mark `[✓] tokens`.
- User declines → mark `[–] tokens`. Note downstream impact: "no token spine → craft will establish a minimal inline token set; it won't match an existing system."

### Gate 3 — Spec

Run `/shape` for the surface described in `$ARGUMENTS`. Shape produces its full five-step output (content inventory, ASCII layout, state list, open questions). When shape completes, its Step 6 offers to persist the output to `.ui-craft/spec.md`.

- User confirms persist → `.ui-craft/spec.md` is written (or the surface section is appended). Mark `[✓] spec`.
- User declines persist → mark `[–] spec (unsaved)`. Note downstream impact: "no spec.md → craft will build against shape's printed output; acceptance bar will not be persisted."

### Gate 4 — Build

Run `/craft <surface>` where `<surface>` matches the description in `$ARGUMENTS`.

If `[✓] spec` was set, craft builds against the acceptance bar recorded in `.ui-craft/spec.md` for this surface. Every acceptance bar item must be green before craft reports done.

If `[–] spec (unsaved)`, craft builds against the shape output printed to the terminal. Note in the checklist.

Mark `[✓] craft` when the build completes.

### Gate 5 — Converge

Run the `visual-anti-slop` preset from `../skills/ui-craft/references/loops.md`. This iterates — evaluate → fix one → re-evaluate — until the zero-critical gate passes or the budget is exhausted (default budget: 3 iterations).

After the loop completes, run `/finalize` to apply the finish bar.

- If the loop gate passes and finalize has no blockers → mark `[✓] converge`.
- If budget exhausted with open findings → mark `[>] converge (open findings)`. List unresolved findings from the loop report.

### Gate 6 — Ship

Run `/finalize` verdict. Finalize reports READY / NOT READY / BLOCKED based on the 10-pass finish bar and the brief/token gate.

Print the final verdict and the complete resolved checklist:

```
[✓] brief   [✓] tokens   [✓] spec   [✓] craft   [✓] converge   [✓] ship
```

**Degraded-mode honesty.** If any gate was marked `[–]`, list them in the ship verdict with their downstream impacts:

> "Skipped gates: tokens (skipped) → token spine not validated; spec (unsaved) → acceptance bar not persisted. These gaps reduce the ship verdict's confidence."

---

## Precedence

Brief §6 learned constraints and the a11y/correctness floor take precedence over spec.md composition choices at every gate. If a constraint conflicts with a spec.md decision, the constraint wins — update the spec section to reflect the winning choice and note the brief §6 reference.
