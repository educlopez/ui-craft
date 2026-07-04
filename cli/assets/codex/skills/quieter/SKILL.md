---
name: quieter
description: "Tone down visual noise — lowers variance and motion, simplifies layout and color weight, keeps hierarchy clear. Use when the UI feels loud, busy, or over-designed, or when the user says "quieter", "more restrained", "simpler", or "tone it down". Invoke when the user asks for quieter on their UI, or mentions 'quieter' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: commands/quieter.md. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Make the UI at `the target the user described` quieter. Load the `ui-craft` skill and read `references/craft-intent.md`.

**Reduce amplitude without gutting hierarchy.** Calm ≠ boring.

**Apply in order (edit code directly):**

1. **Declare an updated Craft Read** — one line: what softened.
2. **Lower DESIGN_VARIANCE** by −1–2 (floor 2). Simplify asymmetric breaks; return to clearer grid rhythm where layout was experimental.
3. **Lower MOTION_INTENSITY** by −1–2 (floor 2). Remove scroll reveals and stagger; keep hover/focus only.
4. **Visual weight** — compress display sizes one step (e.g. 56→48px); reduce shadow depth to hairline or ambient-only; fewer bordered containers.
5. **Color** — pull accent placements toward the 3 minimum; neutralize decorative tints; no new hues.
6. **Cut decorative motion** — idle animations, parallax, floating elements with no job.

**Preserve:** primary hierarchy, one CTA level, accessibility, states, signature detail only if it carries meaning (else simplify it).

**Overlap:** for structural cuts (sections, copy), also apply `/distill` logic. For color strategy, see `/colorize`.

**Output:** edit code. Print Review Format table. End with the updated Craft Read line.
