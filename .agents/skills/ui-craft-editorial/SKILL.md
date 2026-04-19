---
name: ui-craft-editorial
description: "Editorial / magazine / long-form / Medium / Substack / content-heavy UIs. Locked knobs: CRAFT=9, MOTION=4, DENSITY=3. Serif display + humanist body, wide reading column, drop caps, OpenType. Trigger on: editorial, magazine, long-form, blog, Medium-like, Substack-like."
argument-hint: "[action: build|review|polish] [target]"
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

# UI Craft — Editorial

Pre-committed editorial style: magazine, long-form, content-first. Typography carries the hierarchy; layout serves the reading experience.

## Knobs (locked)

- **CRAFT_LEVEL = 9** — editorial typography only works at high refinement; Polish Pass mandatory.
- **MOTION_INTENSITY = 4** — reading-aware: fade on reveal, link hovers, no entrance stagger.
- **VISUAL_DENSITY = 3** — wide reading column, generous vertical rhythm, 1 item per row for features.

Do not re-ask these in Discovery. Confirm accent + serif/sans pairing only.

## Style anchors

- Serif display for headings + humanist body sans/serif for reading.
- Baseline grid feel. `leading-relaxed` (1.7) on body.
- Wide reading column `max-w-[65ch]`. Generous vertical rhythm.
- Accent used for emphasis — pull quotes, drop caps, link underlines — not decoration.
- OpenType features ON: small caps, ligatures, stylistic sets, tabular figures where relevant.
- Asymmetric, text-heavy heroes. Featured image large.
- Motion respects reading: fades only, never pulls the eye away.
- Black text, warm/ivory canvas, one accent. Color is a voice, not a decoration.

## Base rules (inherited)

All rules in `../ui-craft/SKILL.md` apply. This file overrides knob defaults and adds style-specific guidance below. The anti-slop and craft tests still apply in full.

## Style-specific overrides

**Typography (the whole point)**

- Display: Playfair Display, Fraunces, Lora, or Source Serif 4 for headings and pull quotes.
- Body: Alegreya, Source Sans 3, ITC Charter, or a humanist pairing. Do NOT use Inter as primary body — it reads as product UI, not editorial.
- Max two families: one display + one body.
- Headings: `text-wrap: balance`, `font-optical-sizing: auto`, tracking near 0 or slightly negative on large sizes.
- Body: `text-wrap: pretty`, `line-height: 1.7`, `font-feature-settings: "liga", "kern"`.
- Drop caps via `p:first-of-type::first-letter { float: left; font-size: 4.5em; line-height: 0.85; padding: 6px 10px 0 0; font-family: <display>; }`.
- Small caps via `font-variant-caps: small-caps` for section labels, bylines.
- Opt-in OpenType: `font-feature-settings: "ss01", "cv11"` when the chosen font supports them.
- Pull quotes: serif, large (1.75-2.25em), one accent color, short rule above.

**Color**

- Canvas: ivory or warm white — `oklch(98% 0.01 85)` — not pure `#fff`.
- Text: `oklch(18% 0.01 40)` warm near-black.
- Restricted palette: black, ivory/warm white, ONE accent. That's it.
- Accent applied to: drop cap, pull quote, inline link underline, section rule. Not buttons that don't need it.

**Spacing & layout**

- Reading column: `max-w-[65ch]` for body; hero and featured image can break out to `max-w-5xl`.
- Vertical rhythm on body: paragraph spacing = line-height × 0.6 minimum.
- Asymmetric heroes: left-aligned display headline + byline + featured image below or offset.
- Section breaks: centered ornament or a short rule, not a full-width divider.

**Motion**

- Fade on scroll reveal for hero/featured image only, 300-400ms ease-out.
- Inline link hover: underline-offset grows 1px, color shifts to accent, 120ms.
- No entrance stagger, no parallax, no page transitions that fight the reading flow.
- Honor `prefers-reduced-motion` — cut all reveals.

**Content components**

- Byline: small caps, tracking-wide, secondary text color.
- Dateline + read time: tabular-nums, separated by a bullet `·`.
- Inline images: full-width or breakout beyond column, with italic serif caption underneath.
- Blockquote: left border in accent, serif italic, `max-w-[55ch]`.

## Reference files to read first

Load these from `../ui-craft/references/`:

- `typography.md` — the primary reference for this style
- `layout.md` — reading column, rhythm, hierarchy
- `color.md` — warm palette, accent discipline
- `copy.md` — editorial voice, headings, empty states

Skip `dashboard.md`, `performance.md` (standard web perf is fine), `sound.md` unless relevant.

## Anti-patterns for THIS style

- Inter, Geist, DM Sans as primary body. They signal product UI, not editorial.
- Three font families. Always one display + one body.
- Pure `#fff` canvas. Warm it.
- Tight `leading-tight` on body copy. Reading needs 1.6-1.8.
- Colored pull quote backgrounds, gradient text on headlines, emoji in section rules.
- Scroll-triggered stagger or parallax — breaks reading flow.
- Card grids for articles — use stacked list with thumbnail + dek.
- Sans-serif display headlines by default. If you need sans display, the user probably wants minimal variant.
- Uppercase headlines. Sentence case, always (small caps for bylines is the exception).
- CTAs with heavy pill backgrounds — prefer inline underlined links in the serif voice.
