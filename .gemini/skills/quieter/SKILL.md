---
name: quieter
description: "Tone down visual weight — fewer accents, softer type, less motion. Invoke when the user asks for quieter on their UI, or mentions 'quieter' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Quiet the UI at the target the user described. Load the `ui-craft` skill.

**Overlap flag**: `/quieter` is about visual *weight* (accents, type, shadows, motion). `/distill` is about *content and structure* (cutting sections, words, props). If the UI is shouting because there's too much of it, run `/distill` first.

**Pass in order:**

1. **Count accents per viewport.** Cut to 1-3. The primary CTA keeps its accent; everything else goes neutral unless it's a true semantic state (success/warning/danger on a real status).
2. **Soften type.** Headings: weight 800 → 600, size 72 → 56, tracking -0.04em → -0.02em. Don't remove hierarchy — compress the range.
3. **Depth.** Replace hard drop shadows with subtle ambient + direct (see `references/modern-css.md`), or switch to 1px borders. Never both.
4. **Motion.** Remove any animation that isn't communicating state or hierarchy. Decorative scroll reveals, idle float/bob, mouse-tracking glows → gone.
5. **Color.** Mute any purely decorative color. Background patterns, tinted cards without meaning, colored left borders on every list item → gone.
6. **Density.** If every section is full-bleed and high-contrast, let some breathe — increase section padding, reduce contrast on secondary surfaces.

**Knob awareness (MOTION_INTENSITY):**
- `MOTION_INTENSITY 8+` → the user explicitly picked high motion. Warn: "user picked high motion; `/quieter` will conflict with intent." Ask before stripping motion.
- `MOTION_INTENSITY ≤ 3` → motion is already minimal; focus on type and color.

**References to read**: `references/color.md` (accent discipline), `references/typography.md` (weight + tracking), `references/animation.md` (Decision Ladder — remove what fails it).

**Output**: edit code directly. Print the Review Format table. Flag anything you left loud on purpose and why.
