---
description: Final craft pass applying the compound details from the polish checklist — micro-typography, spacing rhythm, hover states, and a signature detail — directly to code. Use when the surface is functionally complete but feels unfinished, or when the user says "polish this" / "it looks generic" / "add the final touches".
argument-hint: "[file or component path]"
---

Polish the UI at `$ARGUMENTS`. Load the `ui-craft` skill.

**Source of truth:** read `references/review.md` → **Polish Pass (Compound Details)** section. Apply every item on that list to the target. Do not re-derive the list here — `review.md` owns it.

**Then the signature detail**: if the UI doesn't have one, propose and add it. A subtle motif, an asymmetric layout break, a custom list marker, a distinctive hover — one thing someone would remember.

**Knob gating (CRAFT_LEVEL):**
- `≤ 4` → skip the Polish Pass. Ask the user first before running it.
- `5-7` → apply everything on the list, skip the signature detail unless asked.
- `8+` → apply everything + add a signature detail.

**Output**: edit the code directly (polish is implementation, not critique). After each file, print the Review Format table from SKILL.md showing what changed and why. No full diffs — one row per change.
