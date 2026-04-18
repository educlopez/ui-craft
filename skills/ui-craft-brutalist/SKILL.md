---
name: ui-craft-brutalist
description: "Brutalist / web 1.0 revival variant of ui-craft tuned for yugonostalgic, Nothing-phone-UI, Swiss-print, terminal-aesthetic interfaces where raw typography and hard contrast carry everything. Trigger when the user asks for brutalist, raw, deliberately ugly, Swiss print, Nothing-like, terminal aesthetic, editorial brutalism, or web 1.0 revival designs. Locks preset knobs CRAFT_LEVEL=7, MOTION_INTENSITY=2, VISUAL_DENSITY=6 and overrides ui-craft defaults with mono / geometric sans, 2-4px solid borders, sharp corners, visible Swiss grids, massive type-as-hero, ALL CAPS mono labels, and instant state changes. Defers all base anti-slop and craft rules to ui-craft."
argument-hint: "[action: build|review|polish] [target]"
---

# UI Craft — Brutalist

Pre-committed brutalist style: early-web revival, yugonostalgia (Yung Lean sites), Nothing phone UI, Swiss print editorial. Type-as-hero, hard contrast, visible grids, raw chrome.

## Knobs (locked)

- **CRAFT_LEVEL = 7** — "deliberately raw" still needs precision; Polish Pass enforces the grid.
- **MOTION_INTENSITY = 2** — instant state changes, hover inversion. No entrance animation, no scroll reveal.
- **VISUAL_DENSITY = 6** — above minimal. Grid is visible through layout; chrome is dense, type is dense.

Do not re-ask these in Discovery. Confirm single accent color and light/dark/inverted default only.

## Style anchors

- Monospace OR geometric sans — IBM Plex Mono, JetBrains Mono, Space Grotesk, Neue Haas Grotesk. Bold dominates.
- Black on white (or inverted). ONE saturated accent, used sparingly.
- `2-4px solid` borders over shadows. Sharp corners — `rounded-none` or ≤4px.
- Visible Swiss grid — asymmetric `col-span-2` + `col-span-7` combos. Show the grid through the layout.
- Type-as-hero — headlines 120-200px, tight tracking, single color.
- ALL CAPS + monospace + wide tracking reserved for labels and callouts (this is the ONE anti-slop exception).
- Instant state changes. No springs, no stagger, no scroll choreography.
- Raw chrome — footnote numbers, marginalia, meta-labels are welcome.

## Base rules (inherited)

All rules in `../ui-craft/SKILL.md` apply. This file overrides knob defaults and adds style-specific guidance below. The anti-slop and craft tests still apply in full.

## Style-specific overrides

**Typography (carries everything)**

- Mono: IBM Plex Mono, JetBrains Mono, Geist Mono. For chrome labels, data, meta, code.
- Geometric sans: Space Grotesk, Neue Haas Grotesk, Inter tight. For headlines and body.
- Weights: 500/700 default; 900 on hero type. Never light-weight display.
- Headline tracking: `tracking-tight` to `tracking-[-0.04em]` on 80px+.
- Labels: ALL CAPS + mono + `tracking-[0.08em]` + small size (10-12px). This is the brutalist exception to anti-slop uppercase rule.
- Body: geometric sans at 14-16px, `leading-snug` (1.4-1.5) — not editorial.
- No serif body. No humanist sans as display.

**Color**

- Canvas: `#fff` or `#000`. Pure. Brutalist context allows pure black/white as the anti-slop exception — but ONE neutral per surface.
- Text: inverted from canvas. No secondary gray text as default; use mono smallcaps labels for hierarchy instead.
- ONE saturated accent — used on a single CTA, a single headline word, or a single marker per viewport. Hex-level discipline.
- No gradients. No tints. No semi-transparent overlays.

**Borders & elevation**

- `2-4px solid` black (or white, if inverted) borders on cards, inputs, buttons, sections.
- Sharp corners — `rounded-none` default; `rounded-[2px]` or `rounded-[4px]` maximum.
- No shadows. No glows. No elevation layers — borders and position create hierarchy.
- Offset borders (e.g. `translate + hard shadow box`) are on-brand if used with restraint.

**Grid & layout**

- Visible Swiss grid — 12 columns with asymmetric spans. Combine `col-span-2` + `col-span-7` + `col-span-3` deliberately.
- Show grid gutters through content placement, not gridlines overlays.
- Deliberate margin collapse — headlines flush against section edges, content offset by one column.
- Section padding: chunky — `py-16` to `py-32`, but framed by visible rules (2px top/bottom border) instead of empty whitespace.
- Alignment: mix left-aligned and flush-right within the same section.

**Motion**

- Instant or ≤80ms on all state changes — color swap, border color swap, background invert.
- Hover: invert background + text color, OR swap in the accent. No scale, no fade.
- Focus ring: 2px solid accent outline, offset 2px. No glow.
- Forbidden: springs, entrance stagger, scroll-triggered reveals, parallax, page transitions beyond an instant cut.
- Honor `prefers-reduced-motion` — should already be compatible.

**Chrome & marginalia**

- Footnote numbers, ordinal markers (`01 / 02 / 03`), meta labels (`INDEX · 2026 · v1.2`) are in-style.
- Timestamps and version strings in mono, ALL CAPS, wide tracking.
- Tables: 1-2px rules, mono numerics, tight rows. No striped backgrounds.

## Reference files to read first

Load these from `../ui-craft/references/`:

- `typography.md` — tracking, weight, mono pairing, type-as-hero
- `layout.md` — Swiss grid, asymmetric spans, margin discipline
- `color.md` — hard contrast, single accent, when pure black/white is allowed
- `accessibility.md` — focus rings, contrast with hard inversions

Skip `animation-orchestration.md`, `sound.md`, `inspiration.md` (consumer-warm focus).

## Anti-patterns for THIS style

- Glassmorphism — the opposite philosophy. Never.
- Soft shadows, ambient elevation, colored glows.
- `rounded-lg` / `rounded-xl` / `rounded-2xl` — anything over 4px breaks the style.
- Serif body text. Editorial is a different variant.
- Spring motion, entrance stagger, scroll reveals, parallax.
- Secondary gray text hierarchy — use mono labels + weight instead.
- Multi-accent palettes. One accent, used sparingly, period.
- Pill buttons, rounded-full CTAs, gradient fills.
- Decorative illustrations, stickers, emoji. Marginalia and ordinals carry personality.
- Centered hero layouts with balanced whitespace — asymmetric grid or it's not brutalist.
- Lowercase ALL-CAPS-style label (`tracking-wide` on regular case) — brutalist labels are literally `text-transform: uppercase`.
