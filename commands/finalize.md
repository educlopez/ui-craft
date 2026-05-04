---
description: Pre-ship gate — runs detector, verifies brief and tokens, applies the 10-pass finish bar, ranks findings by feedback hierarchy.
argument-hint: "[file or surface path; defaults to current working surface]"
---

Load the `ui-craft` skill. This command produces findings only — do NOT edit code.

---

## Step 1 — Brief check (gate)

Look for `.ui-craft/brief.md`.

- Absent: STOP. Output: "No brief found. Run `/brief` first. `/finalize` requires a design brief to distinguish intentional decisions from findings." Do not proceed.
- Present: load it. Extract principles (numbered, in conflict-resolution order). These are the override registry for Steps 4–5.

---

## Step 2 — Detector

Run `npx ui-craft-detect` on `$ARGUMENTS` (or current working surface if no argument).

Capture all output. Every Critical detector finding maps directly to a block-ship finding in the report. Preserve detector source labels.

---

## Step 3 — Token check

Quick three-question audit (no deep read required):

1. Are all three token layers present (primitives → semantic → component)?
2. Are both light and dark modes explicitly authored (not inverted)?
3. Are all seven token categories represented (color, spacing, radius, shadow, typography, motion, z-index)?

Any "no": flag as Major. Do not block ship. Append a recommendation: "Run `/tokens` to close the gap at [category]."

---

## Step 4 — Finish bar

Load `references/finish-bar.md`. Run all 10 passes in document order. Do not reorder.

**Knob behavior (apply before running):**

- `CRAFT_LEVEL ≤ 6` AND user did not explicitly invoke `/finalize`: run Passes 1, 6, 8 only; mark remaining as N/A (knob-gated).
- `CRAFT_LEVEL ≥ 7` OR user explicitly invoked `/finalize`: run all 10 passes.
- `MOTION_INTENSITY ≤ 3`: Pass 7 = motion-gap audit only; do not fail on absent entrance animations.
- `VISUAL_DENSITY ≥ 8` AND brief documents compressed rhythm: Pass 4 accepts compressed spacing values.

**For each pass:**

- Collect findings.
- Assign severity per the severity map in `finish-bar.md` (Critical / Major / Minor).
- If a finding conflicts with a recorded principle in `brief.md`: downgrade to "Deferred per brief" and cite the exact principle. If no brief principle covers it, it remains a finding regardless.
- Record file:line when available.

---

## Step 5 — Feedback hierarchy filter

Load `references/review.md` Feedback Hierarchy section.

Group all findings (detector + token + finish-bar) into three tiers:

- **Value** — does the surface solve the problem the brief defines?
- **Ease of Use** — can the user accomplish the primary task?
- **Delight** — is it polished?

If any Value findings exist: surface them first in the report and add a standing recommendation to defer all Delight findings until Value findings are resolved. This prevents polish work masking broken functionality.

---

## Step 6 — Output

Print this report. Do not add preamble.

```
## Finalize report — <surface name>

**Ship verdict:** READY / NOT READY / BLOCKED

> BLOCKED = any Critical finding present.
> NOT READY = any Major finding present, no Critical.
> READY = zero Critical, zero Major (Minor explicitly accepted).

### Block-ship findings (must fix before merge)
- [Pass / detector source] — [finding] — [file:line if available]

### Major findings (fix or defer with recorded reason)
- [...]

### Minor findings (polish; ship-okay if explicitly accepted)
- [...]

### Deferred per brief
- [finding] — [principle from brief.md that defers it]

### Recommended next actions
- [ordered, 3–5 items max]
```

If a tier has no findings, omit the section header entirely.

---

## Step 7 — Hard stops

Do not edit any file. Do not propose code changes inline. The verdict is the output. If the user asks for fixes after reading the report, respond to that as a separate request.
