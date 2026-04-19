---
name: typeset
description: "Typography pass — fonts, scale, hierarchy, micro-typography. Invoke when the user asks for typeset on their UI, or mentions 'typeset' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Typeset the UI at the target the user described. Load the `ui-craft` skill and read `references/typography.md`.

**Note:** typeset is knob-agnostic — typography rules (no ALL CAPS on headings, tracking-tight ≥24px, one body font, etc.) are not tunable.

**Apply, in order:**

1. **Font inventory** — what's loaded? If Inter is the default choice with no reason, ask before accepting it (Inter is the #1 AI-tell). Good alternatives: Geist, DM Sans, Plus Jakarta Sans, system stack. One body font, optionally one display font. Never three.

2. **Scale** — is there a scale or are sizes ad hoc? Anchor to a modular scale (1.125 / 1.2 / 1.25). Sizes: 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 / 72. No 13px / 15px / 17px one-offs unless optical.

3. **Tracking (letter-spacing)**:
   - ≥ 24px → `tracking-tight` (`-0.02em`) or tighter for 40px+
   - 14-20px body → default
   - 11-13px category labels → `tracking-wide` (`+0.06em`) + uppercase IS allowed here (the one exception)
   - Never ALL CAPS on headings, nav, buttons, tables

4. **Leading (line-height)**:
   - Headings: 1.05-1.15
   - Body: 1.5-1.65
   - UI (buttons, labels): 1.2-1.3

5. **Weight hierarchy** — pick 2-3 weights max. Common: 400 body, 500 UI/labels, 600-700 headings. Never load 9 weights "just in case".

6. **Micro-typography** (the compound details):
   - `tabular-nums` on every number you align (tables, stats, timestamps, prices)
   - `text-wrap: balance` on headlines, `text-wrap: pretty` on body
   - Curly quotes (`'` / `"`), em dashes (`—`), en dashes (`–`), no double hyphens
   - `&nbsp;` in brand names, between number + unit, and before final short words in headlines
   - Real apostrophes in contractions
   - `font-feature-settings` or `font-variant-*` for opt-in features (ligatures, ss01, fractions)
   - Straight prime marks (`′`, `″`) for units, not quotes

7. **Hierarchy check** — can you tell primary / secondary / tertiary at a glance? If every line has the same weight or size, collapse or amplify.

## Amplifying hierarchy

If the UI is technically correct but forgettable, use typography as the weapon. **Pick ONE element to carry signature** (never two); boldness is typography, not color or decoration:

1. **Hero headline** — push size to 80-120px, weight to 700-800, tracking to -0.04em. Tight leading (0.95-1.0).
2. **Hierarchy jump** — widen the gap between H1 and body. If H1 is 32px and body is 16px, the UI is whispering; if H1 is 48px+, the ratio reads. Compress or expand the range deliberately.
3. **Micro-motif** — one custom detail that repeats: a hand-drawn underline, numeric counters (`01`, `02`), an asymmetric supporting element, a distinctive list marker.

**Knob gating for amplification (CRAFT_LEVEL):**
- `≤ 4` — skip. Boldness is a craft layer, not a baseline.
- `5-7` — apply the type amplification only. No signature motif unless asked.
- `8+` — type amplification + one signature detail (owned by `/polish`).

**Pre-check:** if an accent is already overused or hierarchy is already loud, you don't have a tameness problem — you have a noise problem. Route to `/distill` (cut) or `/colorize` (reduce accents) instead.

**Output**: edit code directly. Print the Review Format table. Call out the single highest-impact change (usually: "font choice" or "tracking-tight on hero").
