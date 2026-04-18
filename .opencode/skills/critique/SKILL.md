---
name: critique
description: "UX critique — hierarchy, clarity, anti-slop. No code changes unless asked. Invoke when the user asks for critique on their UI, or mentions 'critique' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Critique the UI at the target the user described through a design lens. Load the `ui-craft` skill.

**Knob awareness (CRAFT_LEVEL sets the bar for what counts as "needs work"):**
- `CRAFT_LEVEL 3` → flag only anti-slop **Critical** items. Skip Minor polish.
- `CRAFT_LEVEL 5-7` → flag Critical + Major. Mention Minor polish as optional.
- `CRAFT_LEVEL 9+` → flag everything, including Minor polish and missing signature detail.

**Run these lenses in order:**

1. **Anti-Slop Test** (from SKILL.md): flag every item present. Critical first (ALL CAPS, purple gradients, identical card grids, bounce easing, emoji icons, glassmorphism + neon). Then major (colored pills on trends, thick colored borders, uniform radii, gradient text, walls of text). Then minor (straight quotes, missing `tabular-nums`, generic CTAs).
2. **Craft Test** (from SKILL.md): where does the design fall short of "one accent, 3-5 placements; plain secondary text for comparisons; functional color only; every section earns its space"?
3. **Hierarchy**: can the user tell what's primary, secondary, tertiary at a glance? Or does everything shout equally?
4. **Clarity**: is the value prop legible in 5 seconds? Are CTAs specific (not "Learn more")?
5. **Signature detail**: is there one memorable element that makes this feel designed, not assembled? If not, suggest one (motif, layout break, custom marker, distinctive hover).
6. **Inspiration gap** — read `references/inspiration.md`: what would dub.co / linear.app / vercel.com do differently here?

**Output format** — the Review Format table:

| Before | After | Why |
| --- | --- | --- |

Prioritize by impact, not by file order. End with a one-paragraph summary of the **top 3 changes** that would raise this from "AI-generated" to "designed".

Do NOT edit code. This is a critique.
