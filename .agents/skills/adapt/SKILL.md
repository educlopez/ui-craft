---
name: adapt
description: "Responsive pass — mobile, tablet, desktop, touch, safe areas. Invoke when the user asks for adapt on their UI, or mentions 'adapt' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Adapt the UI at the target the user described across devices. Load the `ui-craft` skill and read `references/responsive.md`.

**Work mobile-first. Don't shrink desktop; grow from mobile.**

**Checklist:**

1. **Breakpoints** — use project's existing system (Tailwind: `sm md lg xl`; CSS: container queries preferred over media queries for components). No magic widths.
2. **Touch** — tap targets ≥ 44×44px (`min-h-11 min-w-11`). Touch zones don't overlap. `touch-action: manipulation` on interactive elements.
3. **Safe areas** — `padding-top: env(safe-area-inset-top)` etc. on fixed headers/footers/FAB. Check iOS notch and Android gesture bar.
4. **No horizontal scroll** at 320px. Test with devtools device mode.
5. **Fluid type** — `clamp(1rem, 0.9rem + 0.5vw, 1.125rem)` for body where scale matters; fixed px for small UI text (labels, captions).
6. **Container queries** — prefer `@container` over viewport media queries for component-level responsiveness. Components that live in sidebars and main content behave differently at the same viewport width.
7. **Hover-less devices** — every hover affordance has a non-hover equivalent. `@media (hover: hover)` to scope desktop-only effects.
8. **Density shifts with viewport** — honor `VISUAL_DENSITY` differently per breakpoint:
   - `VISUAL_DENSITY ≤ 3` → fewer columns and wider spacing even at desktop widths.
   - `VISUAL_DENSITY 8+` → honor dashboard density, but still respect touch/hover distinctions (touch targets stay ≥ 44px on mobile, hover affordances gated behind `@media (hover: hover)`).
   - Mobile always trends toward 1 column and wider spacing regardless of the knob value.
9. **Images** — `aspect-ratio` set; `srcset` + `sizes` for different viewports; `loading="lazy"` below the fold; `fetchpriority="high"` on hero.
10. **Nav pattern** — desktop horizontal → mobile collapses (sheet, drawer, or bottom tabs). Never a hamburger on desktop unless the nav has > 7 top-level items.

**Output**: edit code directly. Print the Review Format table of changes. Flag any responsive bugs you can't fix without more info (missing design for a breakpoint, unclear nav pattern).
