# Motion System — Tokens and Rhythm

Motion as a **system**, not a collection of individual animations. `animation.md` teaches the tactical rules (easing curves, interaction timing, springs); `animation-orchestration.md` teaches multi-stage sequencing; this file teaches the tokens that make every animation in the product speak the same language.

---

## Why a Motion System

Individual animations, hand-tuned per component, produce a product where the dropdown is 180ms, the modal is 220ms, the tooltip is 145ms, the sheet is 350ms — each one defensible in isolation, together a cacophony. A system is like color tokens: a small, named scale that every component picks from, so the product has rhythm. This is what separates "animated" from "designed."

Rule: every animation in the product picks from this scale. A bespoke duration is a finding.

---

## Duration Scale

Five tokens cover 95% of UI. Pick from this scale; do not invent.

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

Never `transition: 153ms`. Never `200ms` on one button and `220ms` on another for the same state.

---

## Easing Scale

Four tokens cover ~95% of UI easing needs. `animation.md` has the full blueprint with alternatives; these are the system defaults.

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
- `ease-in` for UI. The slow start makes the interface feel sluggish.
- `linear` except for loading indicators, marquees, and scroll-linked progress.
- Bespoke easings named "smooth" with `cubic-bezier(0.5, 0.5, 0.5, 0.5)`. That's a straight line.
- Different easings on entrance vs exit of the same element.

---

## Choreography Rules

Five rules for multi-element sequences. `animation-orchestration.md` has the authoring pattern; these rules govern what's correct.

1. **Hierarchy first.** The parent/container animates before the child/content. Context arrives, then detail. Example: modal backdrop fades in (`--motion-fast`), then the modal panel slides (`--motion-medium`), then form fields enter (staggered).
2. **Stagger is 30-80ms.** Between siblings in a list or grid. Never uniform at zero (feels pasted-on), never more than 80ms per item (list feels slow beyond the 6th item).
3. **Exit < enter.** Exits run at ~75% of entrance duration. If entrance is `--motion-medium` (280ms), exit is ~200ms with `--ease-out` or `--ease-in-out`.
4. **Co-located properties share timing.** Multiple properties on one element (transform + opacity + color on hover) use ONE duration + easing, not three competing. `transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);` — not three different durations.
5. **Shared elements use layout animations.** When the "same" element appears in two places (list → detail), use `layoutId` (Motion), View Transitions API, or FLIP — not discrete enter/exit pairs that visually unmount and remount.

---

## Motion Budget per Page

A ceiling on simultaneous entrance animations. This is the tool against AI's "animate everything on mount" slop.

| Surface | Budget |
|---------|--------|
| Landing hero | Up to 3 staggered entrances (headline / subhead / CTA). One scroll-linked element max. |
| Feature section | 1 reveal-on-scroll per card, stagger 40ms, triggers once. |
| Dashboard | **Micro-interactions only.** No entrance animations on metric cards, charts, tables. |
| Forms | 1 focus ring transition per field. No field-by-field staggered entrance. |
| Modals | Backdrop fade + panel transform. Nothing inside the modal animates on open. |
| Settings / admin | Zero entrance animations. High-frequency tool — motion wastes time. |
| Onboarding (first-run) | Larger budget — this is the one moment it pays off. |

If a viewport has more than its budget, cut. Every "let's add one more" compounds.

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
- **Loading indicators keep animating.** Reduced motion is about removing gratuitous motion, not removing signal. A frozen spinner reads as "broken."
- **Essential feedback stays.** A focus ring still needs a perceptible transition (fast, no easing drama) so keyboard users see the state change.

Test: macOS → System Preferences → Accessibility → Display → "Reduce motion." Windows → Settings → Accessibility → Visual effects → "Animation effects" off. Every entrance and exit should still deliver the user to the right visual state, instantly.

---

## Token Export for Design Files

Shareable JSON for Figma variables, Style Dictionary, or tokens.studio:

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

Figma handles `cubicBezier` tokens natively in variables via plugins; Style Dictionary compiles to CSS / JS / iOS / Android targets.

---

## Framework Hints

Short mappings. Full syntax is in `references/stack.md` (load only if user opted into a stack in Discovery).

| Framework | Duration | Easing |
|-----------|----------|--------|
| **Vanilla CSS** | `var(--motion-base)` | `var(--ease-out)` |
| **Tailwind (extend)** | `theme.transitionDuration: { base: '200ms' }` | `theme.transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' }` |
| **Motion (framer-motion)** | `transition={{ duration: 0.2 }}` | `transition={{ ease: [0.22, 1, 0.36, 1] }}` |
| **GSAP** | `gsap.to(el, { duration: 0.2 })` | `ease: 'power2.out'` (≈ ease-out) |
| **CSS @keyframes** | `animation: fadeIn var(--motion-base) var(--ease-out) forwards;` | same |

Map the project's animation library to the token names, not to raw values — when the scale changes, one file updates.

---

## Anti-Patterns

Eight system-level sins. Any one of these invalidates the rest of the work.

- [ ] Bespoke durations (`transition-[153ms]`, `duration: 0.23`). Pick a token.
- [ ] Easings named "smooth" with symmetric `cubic-bezier(0.5, 0.5, 0.5, 0.5)`. That's linear.
- [ ] Parallax on body content (kills scroll performance; hostile to reduced-motion).
- [ ] Scroll-jacking (hijacking the wheel). Users have a mental model for scroll. Don't break it.
- [ ] Bounce / elastic easing on functional UI. Bounce is for celebration, not for buttons.
- [ ] Motion on every hover (death by a thousand animations). Hover affordance is enough; not every row needs to move.
- [ ] Entrance animations on every page load. First visit is special; the 47th is not.
- [ ] Different easings on entrance vs exit of the same element. Asymmetry feels broken.

---

## Sources

- Material Design — Motion guidelines (duration scale, easing curves).
- Apple Human Interface Guidelines — "Motion" and "Accessibility."
- IBM Carbon — Motion tokens.
- Stripe Dashboard — internal motion spec (documented in public talks by design leadership).
- W3C — `prefers-reduced-motion` media query, Web Content Accessibility Guidelines 2.3.3.
