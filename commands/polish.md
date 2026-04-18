---
description: Final polish pass — the compound details that separate "done" from "crafted".
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
