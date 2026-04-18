---
description: Typography pass — fonts, scale, hierarchy, micro-typography.
argument-hint: "[file or component path]"
---

Typeset the UI at `$ARGUMENTS`. Load the `ui-craft` skill and read `references/typography.md`.

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

**Output**: edit code directly. Print the Review Format table. Call out the single highest-impact change (usually: "font choice" or "tracking-tight on hero").
