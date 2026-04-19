---
name: colorize
description: "Introduce color strategically — 90% neutral, one accent, 3-5 placements. Invoke when the user asks for colorize on their UI, or mentions 'colorize' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Add color to the UI at the target the user described. Load the `ui-craft` skill.

**The rule (from SKILL.md):** 90%+ neutral, one accent, 3-5 placements per viewport. Reinforce this before adding anything. More color is not more design.

**Before you touch anything — ask about brand.** If a brand color exists, use it. If not, offer 2-3 options in OKLCH — include one warm (e.g., `oklch(0.67 0.19 45)`) and one cool (e.g., `oklch(0.60 0.18 250)`). Never default to blue.

**Where color EARNS its place:**

- Primary CTA background.
- One key metric tint — accent at ~8% opacity as a subtle background, accent at full strength on the number itself.
- Active state of the current nav item (underline, dot, or subtle tint — pick one).
- Status dots (success / warning / danger), 6-8px, no pills.
- Focus ring (`:focus-visible`).

**Where color does NOT go** (anti-slop territory):

- Heading gradient text.
- Colored left or top borders on every card.
- Uniform chips on every tag/label.
- Emoji-as-icons to inject "color."
- Trend arrows in green/red when a plain `↑`/`↓` + `tabular-nums` would read cleaner.

**Knob gating (VISUAL_DENSITY):**
- `≤ 4` → single accent only, max 3 placements.
- `5-7` → single accent, 3-5 placements, status dots allowed.
- `8+` → semantic palette (success/warning/danger) allowed beyond the single accent — dashboards and data UIs earn this.

## Over-colored? Reduce.

If the UI is already shouting with color, this command also removes color.

1. **Count accents per viewport.** Cut to 1-3. The primary CTA keeps its accent; everything else goes neutral unless it's a true semantic state (success/warning/danger on a real status).
2. **Mute decorative color.** Background patterns, tinted cards without meaning, colored left borders on every list item, heading gradients, colored pills on every tag → gone.
3. **Keep semantic, cut decorative.** Status dots, focus rings, active-nav underlines stay. Color as ornament goes.

**References to read**: `references/color.md` (OKLCH, tokens, dark mode, contrast), `references/accessibility.md` (contrast ratios for AA/AAA).

**Output**: edit code directly. Lift any literal hex into CSS variables (`--color-accent`, `--color-accent-tint`) — respect existing token naming if present. Print the Review Format table. One row per placement, with the ratio check (AA/AAA) on text uses.
