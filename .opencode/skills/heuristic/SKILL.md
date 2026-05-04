---
name: heuristic
description: "Produce a scored heuristic critique of the UI using Nielsen's 10 + 6 design laws + optional persona walkthroughs. Outputs a machine-parseable scorecard. Invoke when the user asks for heuristic on their UI, or mentions 'heuristic' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Score the UI at the target the user described against Nielsen's 10 + 6 design laws. Load the `ui-craft` skill.

**Step 1 — Load the methodology.** Read `references/heuristics.md` for the full rubric, scoring definitions, design law details, and the required output format. Do NOT invent a new format or a new scale.

**Step 2 — Walk Nielsen's 10 heuristics.** Score each 1-5 per the rubric:
- **1** blocks users · **2** severe friction · **3** works but confusing · **4** works, minor polish · **5** best-in-class

For every heuristic, write a concrete finding — quote text, count elements, name the broken flow. Vague findings are rejected.

**Step 3 — Audit the 6 design laws.** PASS / FAIL each with a specific detail:
- Fitts's Law — touch target sizing, CTA placement
- Hick's Law — choice density, nav + select sizing
- Doherty Threshold — perceived latency, optimistic UI
- Cleveland-McGill — chart encoding choice
- Miller's Law — nav depth, form section counts
- Tesler's Law — where complexity lives

**Step 4 — Persona walkthrough (if `--persona=` present).** If the args include `--persona=<name>`, load `references/personas.md` and run the matching walkthrough checklist. Supported: `priya`, `jordan`, `adaeze`, `kwame`, `margo`, `all`. Output the walkthrough as a `| Checklist item | Pass/Fail | Finding | Impact |` table. Without the flag, skip this step.

**Step 5 — Rank findings by impact tag.** Impact order: `blocks-conversion > adds-friction > reduces-trust > minor-polish`. Include at most 5 findings in the ranked list; cut anything at `minor-polish` unless there are no higher-impact findings.

**Step 6 — Output.** Use the exact scorecard format in `references/heuristics.md`:

1. `## Heuristic Scorecard` table
2. `## Design Law Audit` table
3. `## Persona Walkthrough` table (only if `--persona=` was passed)
4. `## Top findings (ranked by impact)` — numbered list, 3-5 items

**Knob awareness:** knob-agnostic. Usability is not a knob — a 2 is a 2 whether `CRAFT_LEVEL` is 3 or 9. Do not soften scores based on `CRAFT_LEVEL`.

**Output contract:**
- This command produces a **critique artifact**, not code. No edits unless the user explicitly asks in a follow-up.
- The scorecard is machine-parseable markdown. A PM can paste it into any issue tracker and file tickets row-by-row. Frame it that way in any preamble.
- No "First Impressions" paragraph, no hedging, no praise padding. Tables + ranked list only.

Do NOT edit code. This is a scored critique.
