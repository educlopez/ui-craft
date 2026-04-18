---
name: bolder
description: "Amplify an under-designed UI that's technically correct but forgettable. Invoke when the user asks for bolder on their UI, or mentions 'bolder' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Make the UI at the target the user described bolder. Load the `ui-craft` skill.

**Pre-check — run the Craft Test from SKILL.md first**: if an accent is already overused or hierarchy is already loud, stop. You don't have a tameness problem — you have a noise problem. Route to `/quieter` instead.

**Bolder is typography and hierarchy, not color or decoration.** Do not add gradients, emoji, colored borders, or new accents. Do not add "pops of color."

**Pick ONE element to carry signature** (never two):

1. **Hero headline** — push size to 80-120px, weight to 700-800, tracking to -0.04em. Tight leading (0.95-1.0).
2. **Hierarchy jump** — widen the gap between H1 and body. If H1 is 48px and body is 16px, the ratio is fine; if H1 is 32px and body is 16px, the UI is whispering.
3. **Micro-motif** — one custom detail that repeats: a hand-drawn underline, numeric counters (`01`, `02`), an asymmetric supporting element, a distinctive list marker.

**Knob gating (CRAFT_LEVEL):**
- `≤ 4` → skip. Boldness is a craft layer, not a baseline. Ask the user before running.
- `5-7` → apply the type amplification. No signature motif unless asked.
- `8+` → type amplification + one signature detail (see `/polish`).

**References to read**: `references/typography.md` (size + weight + tracking), `references/layout.md` (hierarchy ratios), `references/inspiration.md` (what signature looks like on real sites).

**Output**: edit code directly. Print the Review Format table from SKILL.md. One row per change. Flag any element you considered amplifying but left alone, and why.
