---
description: Introduce color strategically — 90% neutral, one accent, 3-5 placements.
argument-hint: "[file or component path]"
---

Add color to the UI at `$ARGUMENTS`. Load the `ui-craft` skill.

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

**References to read**: `references/color.md` (OKLCH, tokens, dark mode, contrast), `references/accessibility.md` (contrast ratios for AA/AAA).

**Output**: edit code directly. Lift any literal hex into CSS variables (`--color-accent`, `--color-accent-tint`) — respect existing token naming if present. Print the Review Format table. One row per placement, with the ratio check (AA/AAA) on text uses.
