---
name: ui-craft-minimal
description: "Minimal / clean / Linear / Notion / Vercel / whitespace-heavy UIs. Locked knobs: CRAFT=8, MOTION=3, DENSITY=2. Monochrome + one accent, Inter/Geist, hairline borders over shadows. Trigger on: minimal, clean, Linear-like, Notion-like, Vercel-like, whitespace-heavy."
argument-hint: "[action: build|review|polish] [target]"
---

# UI Craft — Minimal

Pre-committed minimal style: editorial clean, Linear / Notion / Vercel. Whitespace is the composition. One accent, hairline borders, almost no motion.

## Knobs (locked)

- **CRAFT_LEVEL = 8** — minimal aesthetics only work when executed precisely; Polish Pass is mandatory.
- **MOTION_INTENSITY = 3** — hover + modal enter/exit only. No scroll reveals, no page transitions, no stagger.
- **VISUAL_DENSITY = 2** — whitespace-heavy, 1-2 items per row, generous gutters.

Do not re-ask these in Discovery. Skip straight to accent + font confirmation if ambiguous.

## Style anchors

- Black or near-black type on white or near-white canvas. Monochrome + ONE accent.
- Inter / Geist for body — never a display font.
- Section padding 120-200px vertical, 40-80px gutters.
- Hairline borders `1px solid oklch(92% 0.005 250)` in place of shadows.
- Typography is the hierarchy. No decorative gradients, patterns, or glass.
- Single-column hero default. Asymmetry via one supporting element, not layout tricks.
- Motion is punctuation, not spectacle.
- Every pixel deliberate. When in doubt, cut it.

## Base rules (inherited)

All rules in `../ui-craft/SKILL.md` apply. This file overrides knob defaults and adds style-specific guidance below. The anti-slop and craft tests still apply in full.

## Style-specific overrides

**Typography**

- Body: Inter or Geist, 400 weight. UI emphasis: 500. Never 600/700 in body copy.
- `system-ui, -apple-system` as fallback stack.
- Headings: `tracking-tight` / `-0.02em` above 24px, 500 or 600 max.
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.
- No display serifs. No geometric display sans. No mixing two sans families.

**Color**

- Surface: `oklch(99% 0 0)` (light) / `oklch(14% 0.005 250)` (dark).
- Text: `oklch(18% 0.01 250)` primary, `oklch(46% 0.01 250)` secondary.
- Accent reserved for: primary CTA, active nav item, one key metric. That is it.
- Borders: `oklch(92% 0.005 250)` light / `oklch(24% 0.008 250)` dark. No colored borders.

**Spacing & layout**

- Section vertical: `py-24 md:py-32 lg:py-40` (96 / 128 / 160px) minimum; 200px for hero on large screens.
- Container: `max-w-5xl` typical; `max-w-3xl` for reading content.
- One accent placement per viewport preferred; two max.
- No card grids with more than 2 columns on desktop.

**Borders & elevation**

- Default chrome = 1px hairline border, no shadow.
- Elevation only for floating UI (menus, toasts, modals) — single soft ambient shadow, not layered.
- Radius: 6px inputs, 8px cards, 12px modals. Keep the scale narrow.

**Motion**

- Allowed: hover (opacity / border color, 120-150ms), modal + dialog enter/exit (180-220ms ease-out), focus ring.
- Forbidden at this intensity: scroll-triggered reveals, stagger, page transitions, parallax, magnetic cursor, entrance choreography.
- Any animation must honor `prefers-reduced-motion`.

**Composition**

- Hero: left-aligned or centered headline, ONE supporting element (social proof line, screenshot, single chip). No floating badges, orbs, blobs.
- Features: stacked rows with a single real visual each. No 3-up uniform icon grids even when tempting.
- Nav: text-only links, current state = accent underline or weight 500. No pill backgrounds.

## Reference files to read first

Keep the reading list tight. Load only these from `../ui-craft/references/`:

- `layout.md` — spacing, hierarchy, composition
- `typography.md` — scale, readability, weight
- `color.md` — monochrome scales, OKLCH, dark mode
- `accessibility.md` — focus, contrast, keyboard

Skip `dashboard.md`, `stack.md`, `sound.md` unless explicitly relevant.

## Anti-patterns for THIS style

- Multiple accent colors. One accent, period.
- Display serifs, geometric display sans, or mixing two sans families.
- Decorative gradients, mesh backgrounds, noise overlays, glass panels.
- Scroll-triggered reveals, stagger, page transitions — even "subtle" ones.
- Uniform 3-column icon-heading-text feature grids.
- Colored shadows or glows as affordances.
- Dense layouts. If density feels right, this is the wrong variant — switch to `ui-craft-dense-dashboard`.
- Pill backgrounds on nav links or buttons by default; prefer text + underline.
- Section padding under 96px on desktop.
