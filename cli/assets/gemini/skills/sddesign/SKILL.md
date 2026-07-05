---
name: sddesign
description: "Full spec-driven pipeline — walks brief → tokens → shape (spec) → craft (build) → converge → ship in one guided run. Writes `.ui-craft/spec.md`. Run when starting a net-new surface from scratch. Invoke when the user asks for sddesign on their UI, or mentions 'sddesign' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: skills/ or commands/. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Run the spec-driven design pipeline for the target the user described. Load the `ui-craft` skill.

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
[ ] brief   [ ] tokens   [ ] shape (spec)   [ ] craft (build)   [ ] converge   [ ] ship
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

### Gate 3 — Shape (spec)

**Existing-surface guard:** Before running `/shape`, check if `.ui-craft/spec.md` already contains a `## Surface: <name>` block for this surface. If it does, do NOT re-run shape and blindly append a duplicate section — offer to update the existing section or skip shape (the spec already exists).

Run `/shape` for the surface described in the target the user described. Shape produces its full five-step output (content inventory, ASCII layout, state list, open questions).

**Persist in pipeline (default):** Inside the `/sddesign` pipeline, shape's Step 6 spec persist is the default — it is auto-confirmed unless the user explicitly opts out of the spec gate. The persist writes `.ui-craft/spec.md` (or appends the surface section). This is the whole point of the pipeline.

- Persist completes → `.ui-craft/spec.md` is written (or the surface section is appended). Mark `[✓] shape (spec)`.
- User explicitly opts out of persist → mark `[–] shape (spec, unsaved)`. Note downstream impact: "no spec.md → craft (build) will build against shape's printed output; acceptance bar will not be persisted."

### Gate 4 — Craft (build)

Run `/craft <surface>` where `<surface>` matches the description in the target the user described.

`/craft` declares the **Craft Read** (`references/craft-intent.md`) before building — surface kind, audience, theme/accent, DESIGN_VARIANCE, and the one **signature bet**. The signature bet is built inside this gate, not deferred to converge or polish. If the spec section names a composition, the Craft Read must be consistent with it.

`/craft` loads `.ui-craft/spec.md` before building. If `[✓] shape (spec)` was set, the spec's chosen composition, component inventory, state lattice, and acceptance bar take precedence over recipe defaults — every acceptance bar item from the spec must be green before craft reports done.

If `[–] shape (spec, unsaved)`, craft builds against the shape output printed to the terminal. Note in the checklist.

Mark `[✓] craft (build)` when the build completes.

### Gate 5 — Converge

Run the `visual-anti-slop` preset from `../skills/ui-craft/references/loops.md`. This iterates — evaluate → fix one → re-evaluate — until the zero-critical gate passes or the budget is exhausted (default budget: 3 iterations).

- If the loop gate passes (zero critical findings) → mark `[✓] converge`.
- If budget exhausted with open findings → mark `[>] converge (open findings)`. List unresolved findings from the loop report.

### Gate 6 — Ship

Run `/finalize` verdict. Finalize reports READY / NOT READY / BLOCKED based on the 10-pass finish bar and the brief/token gate.

Print the final verdict and the complete resolved checklist:

```
[✓] brief   [✓] tokens   [✓] shape (spec)   [✓] craft (build)   [✓] converge   [✓] ship
```

**Degraded-mode honesty.** If any gate was marked `[–]`, list them in the ship verdict with their downstream impacts:

> "Skipped gates: tokens (skipped) → token spine not validated; shape (spec, unsaved) → acceptance bar not persisted. These gaps reduce the ship verdict's confidence."

---

## Precedence

Brief §6 learned constraints and the a11y/correctness floor take precedence over spec.md composition choices at every gate. If a constraint conflicts with a spec.md decision, the constraint wins — update the spec section to reflect the winning choice and note the brief §6 reference.
