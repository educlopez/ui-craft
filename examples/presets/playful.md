---
title: "UI Craft — Playful Preset"
description: "Playful / friendly-pop preset for ui-craft tuned for Clay-like, Gumroad-like, Duolingo-like, and Arc Browser approachable UIs with spring motion, generous radii, and multi-accent warmth."
---

# UI Craft — Playful

This is a preset for the main `ui-craft` skill. When the user asks for a Clay / Gumroad / Duolingo / Arc-playful UI, the main skill should read this file and apply the locked knob values + style overrides while still following the base craft rules.

Pre-committed playful style: friendly-pop, Clay / Gumroad / Duolingo / Arc Browser. Warmth via spring motion, generous radii, and saturated-but-tuned multi-accents.

## Knobs (locked)

- **CRAFT_LEVEL = 8** — playful without craft reads as childish; Polish Pass mandatory.
- **MOTION_INTENSITY = 7** — spring-heavy, entrance stagger, page transitions allowed. Motion carries the personality.
- **VISUAL_DENSITY = 4** — moderate. Cards breathe, but layout has rhythm and variety.

Do not re-ask these in Discovery. Confirm primary accent + whether dark mode is in scope.

## Style anchors

- Bouncy-but-legible sans (Satoshi, General Sans, Inter 600/700 on headlines). Rounded feel, never system font.
- Multi-accent allowed (max 3 per viewport) — one primary, pair warm + cool. Saturated OKLCH, tuned not neon.
- Generous radii — `rounded-2xl` cards, `rounded-full` buttons, `rounded-3xl` hero containers.
- Spring motion (stiffness 200-300, damping 20-25). Overshoot, never bounce easing.
- Soft colored shadows instead of flat elevation.
- Subtle texture or gradient mesh backgrounds — noise filter, not decorative orbs.
- Custom / abstract illustrations welcome; never stock emoji or generic Figma illustrations.
- Warmth comes from motion + color pairing, not clutter.

## Base rules (inherited)

All rules in the main `ui-craft` SKILL.md apply. This preset overrides knob defaults and adds style-specific guidance below. The anti-slop and craft tests still apply in full.

## Style-specific overrides

**Typography**

- Display + UI: Satoshi, General Sans, or Inter. Headlines at 600-700. Never system-ui as primary.
- Body: same family at 400-500, `text-wrap: pretty`, leading 1.55-1.65.
- Headings: `tracking-tight` on 32px+, `text-wrap: balance`.
- Numeric: `tabular-nums` in metrics, never in prose.
- No two sans families. No monospace in chrome (labels OK).

**Color**

- Saturated OKLCH, chroma `0.15-0.20`, lightness `65-75%`. Tune for screens, not for print.
- Pair warm + cool — e.g. `oklch(72% 0.18 30)` coral + `oklch(68% 0.16 240)` blue. One primary, one support, one optional accent.
- Canvas: warm off-white `oklch(98% 0.01 85)` or soft cool `oklch(98% 0.005 250)`. Never pure `#fff`.
- Dark mode: lift surface to `oklch(18% 0.01 250)`, keep accents above 60% lightness.

**Borders, radii & elevation**

- Radii scale: inputs `rounded-xl` (12px), cards `rounded-2xl` (16px), hero containers `rounded-3xl` (24px), buttons `rounded-full`.
- Vary radii by element size — small chips `rounded-lg`, oversized heroes `rounded-[32px]`.
- Shadows: soft + colored, tinted by the element's accent. Example: `shadow-[0_8px_32px_-8px_oklch(70%_0.15_250/0.3)]`.
- Borders only for inputs and dividers, 1px, low-chroma. Don't double borders + shadows on the same element.

**Background & texture**

- Subtle grain noise (3-5% opacity SVG) or a wide, low-contrast gradient mesh on hero sections.
- Not decorative blobs, floating orbs, or rainbow gradients. Keep the palette.

**Motion (the personality)**

- Springs: stiffness `200-300`, damping `20-25`. Overshoot feels alive; avoid `ease-in-out` bounce keyframes.
- `whileHover` scale `1.02-1.04` on cards is in-style here; press state `0.98` with spring.
- Entrance stagger `40-60ms` per child, fade + translate 8-12px.
- Page transitions allowed — shared layout or simple fade/slide at 200-260ms.
- Always honor `prefers-reduced-motion` — swap springs for 150ms fades.

**Composition**

- Hero: single bold headline, generous padding, one illustration or product shot, colored soft shadow underneath. Asymmetric chip or sticker accent is on-brand.
- Feature sections: varied — avoid 3-up uniform icon grids. Mix sizes, offset cards, use a large card + two small.
- Buttons: `rounded-full`, accent fill, white label, subtle colored shadow. Hover lifts 2-3px + saturates.
- Illustrations: custom abstract shapes, isometric or 2.5D if done well. Never generic Figma kits.

## Reference files to read first

Load these from `skills/ui-craft/references/`:

- `color.md` — OKLCH tuning, multi-accent discipline, dark mode
- `motion.md` — spring physics, stagger, entrance choreography
- `typography.md` — weight, tracking, `text-wrap`
- `layout.md` — rhythm, asymmetry, hero composition

Also see `examples/animation-storyboard.md` for multi-stage sequences.

Skip `dashboard.md` unless the user explicitly wants a playful admin tool.

## Anti-patterns for THIS style

- Bounce easing (`cubic-bezier` with overshoot >1.3). Use overshoot springs instead.
- Emoji spam in UI labels, buttons, or headlines. One in the hero tagline is the hard limit.
- Comic Sans, Fredoka, or other "childish" fonts. Playful is friendly, not juvenile.
- Glassmorphism on everything. One panel max; avoid as default chrome.
- More than 3 accent colors per viewport — reads as rainbow, not playful.
- Rainbow gradients across the whole page. Pair two tuned accents max.
- Pure `#fff` canvas with flat `#000` shadows — kills the warmth the palette builds.
- Uniform rounded-xl everywhere — vary radii by element size.
- Stock Figma illustration kits or open-peeps style characters.
- Scroll-jacking, parallax, or cursor-following blobs. Motion serves interaction, not spectacle.
