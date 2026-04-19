# Motion

Unified motion reference — decision ladder, token scales, interaction rules, choreography, motion budget, reduced-motion contract, anti-patterns.

---

## When to Read This

Any motion work: hover, enter/exit, modals, drawers, page transitions, scroll reveals, stagger choreography, spring vs tween decisions, reduced-motion, or bespoke durations showing up in a review.

---

## Decision Ladder

1. **Justify every animation** — motion must communicate something (hierarchy, state, spatial relationship). Decorative motion is noise.
2. **Frequency determines budget** — 100+ times/day gets zero animation. Occasional (modals, drawers) get standard. First-time experiences can delight.

   | Frequency | Animation |
   |-----------|-----------|
   | 100+ times/day (keyboard shortcuts, command palette) | **None. Ever.** |
   | Tens of times/day (hover, list nav, typing) | Remove or drastically reduce — under 150ms or none |
   | Occasional (modals, drawers, toasts) | Standard animation, 200-300ms, clear purpose |
   | Rare / first-time (onboarding, celebrations) | Can add delight — tell a story |

3. **Speed communicates confidence** — under 200ms feels instant. 300ms+ starts feeling sluggish.
4. **Respect the user's system** — `prefers-reduced-motion` is not optional. Provide meaningful fallbacks, not just `animation: none`.
5. **GPU-only properties** — stick to `transform` and `opacity`. Animating `width`, `height`, `top`, `left` causes layout thrashing.
6. **List properties explicitly** — `transition: all` animates things you didn't intend.

**Asymmetric enter/exit.** Pressing can be slow when deliberate (hold-to-delete: 2s linear), but release is always snappy (200ms ease-out). Slow where user decides, fast where system responds.

---

## Duration Scale

Five tokens cover ~95% of UI. Pick from this scale; do not invent.

```css
:root {
  --motion-fast:   120ms; /* color / opacity, tooltip, hover */
  --motion-base:   200ms; /* small UI — dropdown, toggle, tab, select */
  --motion-medium: 280ms; /* medium UI — modal open, drawer, popover */
  --motion-slow:   400ms; /* large UI — page transition, full sheet */
  --motion-slower: 600ms; /* decorative / onboarding — sparingly */
}
```

| Token | Range | Use for |
|-------|-------|---------|
| `--motion-fast` | 120ms | Opacity, color, hover, focus ring, tooltip show/hide |
| `--motion-base` | 200ms | Dropdowns, toggles, tabs, selects, chips, accordion |
| `--motion-medium` | 280ms | Modals, popovers, drawers (desktop), snackbars |
| `--motion-slow` | 400ms | Page transitions, drawers (mobile), full-screen sheets |
| `--motion-slower` | 600ms | Hero animations, onboarding choreography, first-run only |

Never `transition: 153ms`. Never `200ms` on one button and `220ms` on another for the same state. A bespoke duration is a finding.

---

## Easing Scale

Four tokens cover ~95% of UI easing. System defaults — framework libraries have their own defaults (see `stack.md` for Motion/GSAP mapping).

```css
:root {
  --ease-out:         cubic-bezier(0.22, 1, 0.36, 1);   /* entrances, most UI */
  --ease-in-out:      cubic-bezier(0.65, 0, 0.35, 1);   /* same-layer transitions */
  --ease-emphasized:  cubic-bezier(0.2, 0, 0, 1);       /* hero, attention-grabbing */
  --ease-soft:        cubic-bezier(0.4, 0, 0.2, 1);     /* Material-like, general purpose */
}
```

| Token | When to use |
|-------|-------------|
| `--ease-out` | Default for almost everything. Entrances, hover, dropdown, modal open. |
| `--ease-in-out` | Elements already on screen that move or morph (layout changes, repositioning). |
| `--ease-emphasized` | One element per viewport — hero reveal, primary CTA emphasis. |
| `--ease-soft` | Gentler alternative for general UI; Material-style products. |

**Never:**
- `ease-in` for UI — slow start delays visual feedback. A dropdown with `ease-in` at 300ms *feels* slower than `ease-out` at the same duration.
- `linear` except loading indicators, marquees, scroll-linked progress, hold-to-delete indicators.
- Bespoke easings named "smooth" with `cubic-bezier(0.5, 0.5, 0.5, 0.5)` — that's a straight line.
- Bounce / elastic easing on functional UI — reads dated and draws attention to the animation itself.
- Different easings on entrance vs exit of the same element.

---

## Interaction Rules

- **Interaction feedback ≤ 100ms** — if it takes longer, it stops feeling like a reaction.
- **Hover contract** — transform + color + shadow move together, never just one property.
- **Focus contract** — a focus ring still needs a perceptible transition (fast, no easing drama) so keyboard users see the state change.
- **Disable interactions on exiting elements** — visually present, logically gone.
- **Never block interaction while a stagger plays** — decorative motion must not gate input.

General interaction rules (keyboard timing, touch targets, `overscroll-behavior`, `touch-action`, optimistic UI, destructive confirmations) live in `accessibility.md` — honor them on every animated control.

---

## Choreography Rules

**Exit runs at ~75% of entrance duration.** This is the one rule that matters most. If entrance is `--motion-medium` (280ms), exit is ~200ms with `--ease-out` (or a flatter tail like `cubic-bezier(0.4, 0, 1, 1)`).

1. **Hierarchy first.** Parent/container animates before child/content. Context arrives, then detail. Modal backdrop fades in (`--motion-fast`), then the modal panel slides (`--motion-medium`), then form fields enter (staggered).
2. **Stagger is 30-80ms between siblings.** Never uniform at zero (feels pasted-on), never more than 80ms per item (list feels slow beyond the 6th item). Marketing pages can push to 100-150ms for dramatic entrances.
3. **Co-located properties share timing.** Multiple properties on one element (transform + opacity + color on hover) use ONE duration + easing, not three competing. `transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);` — not three different durations.
4. **Shared elements use layout animations.** When the "same" element appears in two places (list → detail), use `layoutId` (Motion), View Transitions API, or FLIP — not discrete enter/exit pairs that visually unmount and remount.
5. **Exit mirrors initial** for symmetry: if entering from `opacity: 0, y: 20`, exit to the same.
6. **Unique keys** (not index) for dynamic lists — enables smooth add/remove.
7. **List reordering** needs layout animation mode, not sequential mode.
8. **Wait modes nearly double perceived duration** — use shorter durations when sequencing enter/exit.

Stagger example:

```css
.item:nth-child(1) { animation-delay: 0ms; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
```

For multi-stage storyboards with named timing + config objects + stage-driven sequencing, see `../examples/animation-storyboard.md`.

---

## Motion Budget per Surface

A ceiling on simultaneous entrance animations. This is the tool against AI's "animate everything on mount" slop.

| Surface | Budget |
|---------|--------|
| Landing hero | Up to 3 staggered entrances (headline / subhead / CTA). One scroll-linked element max. |
| Feature section | 1 reveal-on-scroll per card, stagger 40ms, triggers once. |
| Dashboard | **Micro-interactions only.** No entrance animations on metric cards, charts, tables. |
| Forms | 1 focus ring transition per field. No field-by-field staggered entrance. |
| Modals | Backdrop fade + panel transform. Nothing inside the modal animates on open. |
| Settings / admin | Zero entrance animations. High-frequency tool — motion wastes time. |
| Onboarding (first-run) | Larger budget — the one moment it pays off. |

If a viewport has more than its budget, cut. Every "let's add one more" compounds.

---

## Spring vs Tween

> **Pick spring OR tween globally, not per-component.** Mixing in the same app reads as inconsistent. Document the choice in the project's design doc.

Springs feel natural because they simulate real physics — no fixed duration, they settle based on physical parameters.

**Use springs when:**
- Drag interactions with momentum
- Elements that should feel "alive" (Dynamic Island)
- Gestures that can be interrupted mid-animation (springs maintain velocity; CSS animations restart from zero)
- Mouse-tracking decorative interactions (`useSpring` to interpolate)

**Use tween when:**
- The project has strict duration budgets (200-300ms UI rule)
- Deterministic motion matches the brand
- Motion is purely functional (no "alive" personality)

**Spring configuration (Motion / Framer):**

```js
// Apple-style (recommended — easier to reason about)
{ type: "spring", duration: 0.5, bounce: 0.2 }

// Traditional physics (more control)
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

**Spring rules:**
- Keep bounce subtle (0.1-0.3) when used; avoid in most functional UI.
- Balanced parameters: `stiffness: 500, damping: 30` settles quickly; `stiffness: 1000, damping: 5` is too bouncy.
- Drag release: `{ type: "spring", velocity: info.velocity.x }` preserves input energy.
- Springs have no fixed duration → constrain via `bounce ≤ 0.25` and `visualDuration`.

**Spring presets:**

| Use case | Config |
|----------|--------|
| Cards / containers (smooth settle) | `stiffness: 300, damping: 30` |
| Pop-ins / badges (snappy) | `stiffness: 500, damping: 25` |
| Slides / entrances (balanced) | `stiffness: 350, damping: 28` |
| Drag release | `stiffness: 500, damping: 30` + velocity |

---

## Reduced-Motion Contract

`prefers-reduced-motion` is not optional. The system must degrade to zero-motion gracefully — not break, not disappear, not skip states.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Two exceptions to "disable everything":**
- **Loading indicators keep animating.** Reduced motion removes gratuitous motion, not signal. A frozen spinner reads as "broken."
- **Essential feedback stays.** A focus ring still needs a perceptible transition (fast, no easing drama) so keyboard users see the state change.

Test: macOS → System Preferences → Accessibility → Display → "Reduce motion." Windows → Settings → Accessibility → Visual effects → "Animation effects" off. Every entrance and exit should still deliver the user to the right visual state, instantly.

---

## Anti-Patterns

- [ ] Bespoke durations (`transition-[153ms]`, `duration: 0.23`). Pick a token.
- [ ] `transition: all` — list specific properties.
- [ ] Easings named "smooth" with symmetric `cubic-bezier(0.5, 0.5, 0.5, 0.5)`. That's linear.
- [ ] Bounce / elastic easing on functional UI. Bounce is for celebration, not buttons.
- [ ] `ease-in` on UI — slow start reads as sluggish.
- [ ] Parallax on body content (kills scroll performance; hostile to reduced-motion).
- [ ] Scroll-jacking (hijacking the wheel). Users have a mental model for scroll. Don't break it.
- [ ] Motion on every hover (death by a thousand animations). Hover affordance is enough; not every row needs to move.
- [ ] Entrance animations on every page load. First visit is special; the 47th is not.
- [ ] Different easings on entrance vs exit of the same element. Asymmetry feels broken.
- [ ] Exaggerated scale on hover (`1.08+` on CTAs). Keep ≤ 1.02 for functional UI; 1.02-1.05 for cards.
- [ ] Animating `width` / `height` / `top` / `left` — layout thrash. Use `transform` / `opacity`.

---

## Figma JSON Export

Shareable tokens for Figma variables, Style Dictionary, or tokens.studio:

```json
{
  "motion": {
    "duration": {
      "fast":    { "value": 120, "type": "duration", "unit": "ms" },
      "base":    { "value": 200, "type": "duration", "unit": "ms" },
      "medium":  { "value": 280, "type": "duration", "unit": "ms" },
      "slow":    { "value": 400, "type": "duration", "unit": "ms" },
      "slower":  { "value": 600, "type": "duration", "unit": "ms" }
    },
    "ease": {
      "out":        { "value": [0.22, 1, 0.36, 1],   "type": "cubicBezier" },
      "inOut":      { "value": [0.65, 0, 0.35, 1],   "type": "cubicBezier" },
      "emphasized": { "value": [0.2, 0, 0, 1],       "type": "cubicBezier" },
      "soft":       { "value": [0.4, 0, 0.2, 1],     "type": "cubicBezier" }
    }
  }
}
```

Figma handles `cubicBezier` via plugins; Style Dictionary compiles to CSS / JS / iOS / Android.

**Framework mapping:**

| Framework | Duration | Easing |
|-----------|----------|--------|
| Vanilla CSS | `var(--motion-base)` | `var(--ease-out)` |
| Tailwind (extend) | `theme.transitionDuration: { base: '200ms' }` | `theme.transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' }` |
| Motion (framer-motion) | `transition={{ duration: 0.2 }}` | `transition={{ ease: [0.22, 1, 0.36, 1] }}` |
| GSAP | `gsap.to(el, { duration: 0.2 })` | `ease: 'power2.out'` (≈ ease-out) |

Map the project's animation library to the token names, not raw values — when the scale changes, one file updates.

---

## Cross-Refs

- `stack.md` — Motion / GSAP / Three.js library specifics (opt-in during Discovery).
- `modern-css.md` — `@starting-style` for enter-on-mount, View Transitions API.
- `performance.md` — compositor / GPU gotchas, `will-change` lifecycle, shorthand props.
- `accessibility.md` — reduced-motion + full interaction rules (keyboard, focus, touch).
- `../examples/animation-storyboard.md` — multi-stage sequenced animations pattern.

---

## Sources

- Material Design — Motion guidelines.
- Apple Human Interface Guidelines — "Motion" and "Accessibility."
- IBM Carbon — Motion tokens.
- W3C — `prefers-reduced-motion`, WCAG 2.3.3.
