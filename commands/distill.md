---
description: Strip to essence. Cut every section that doesn't earn its space.
argument-hint: "[file or component path]"
---

Distill the UI at `$ARGUMENTS` to its essence. Load the `ui-craft` skill.

**The test for every section, component, prop, and word:**

> Does this answer a question the user is asking or drive an action they need to take? If not — cut it.

**Knob gating (CRAFT_LEVEL):**
- `≤ 4` → be more aggressive with cuts; strip anything that doesn't directly drive action.
- `5-7` → standard cuts per the test below.
- `8+` → preserve signature details even if they don't directly drive action — the one memorable element that makes this feel designed stays.

**Apply ruthlessly:**

1. **Content** — walls of text → 2-3 sentences max per landing section. Vague testimonials → specific metrics or cut. "Features" lists with 12 items → pick the 4 that matter. Placeholder copy → real or removed.
2. **Structure** — identical card grids → asymmetric rows with real visuals. Three competing CTAs → one primary + one secondary. Breadcrumbs + title + subtitle + description + icon → pick the two that are load-bearing.
3. **Visuals** — decorative gradient blobs → gone. Background patterns that don't carry meaning → gone. Duplicate iconography → gone.
4. **Visual weight reduction** — if headings are shouting at weight 800 / 72px / tracking -0.04em, compress: 800 → 600, 72 → 56, -0.04 → -0.02. Don't remove hierarchy; tighten the range. Replace hard drop shadows with ambient + direct (`references/modern-css.md`) or 1px borders — never both. If every section is full-bleed and high-contrast, let some breathe.
5. **Code** — unused props, dead branches, commented-out blocks, `console.log`, TODO notes without tickets — gone.
6. **Anti-slop overlap** — if you see anything on the Anti-Slop Test (SKILL.md), cut it first.

**Overlapping commands:** for color overload (too many accents, decorative color), use `/colorize`. For motion noise, use `/animate` with `MOTION_INTENSITY ≤ 3`.

**Output**:
- Edit code directly.
- Report what was cut and why in a table:

| Cut | Why |
| --- | --- |

- End with a one-line **delta**: "Before: N sections / M components / X lines. After: …".

**Guardrail**: do not cut accessibility affordances (labels, focus styles, error text, reduced-motion fallbacks) — those always earn their space.
