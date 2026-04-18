# Animation Mastery

Deep reference for motion design — easing curves, springs, timing, orchestration, and debugging.

---

## The Easing Blueprint

### ease-out (Most Common)

Use for **user-initiated interactions**: dropdowns, modals, tooltips, any element entering or exiting. The fast start creates responsive feel — the element "jumps" toward its destination then settles.

```css
/* Sorted weak → strong */
--ease-out-quad:  cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
--ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1);    /* ← recommended default */
--ease-out-expo:  cubic-bezier(0.19, 1, 0.22, 1);
--ease-out-circ:  cubic-bezier(0.075, 0.82, 0.165, 1);
```

### ease-in-out (For Movement)

Use when **elements already on screen move or morph**. Mimics natural acceleration/deceleration.

```css
--ease-in-out-quad:  cubic-bezier(0.455, 0.03, 0.515, 0.955);
--ease-in-out-cubic: cubic-bezier(0.645, 0.045, 0.355, 1);
--ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);    /* ← recommended */
--ease-in-out-quint: cubic-bezier(0.86, 0, 0.07, 1);
--ease-in-out-expo:  cubic-bezier(1, 0, 0, 1);
--ease-in-out-circ:  cubic-bezier(0.785, 0.135, 0.15, 0.86);
```

### ease (For Hover)

Asymmetrical curve (faster start, slower end) — elegant for gentle hover/color transitions.

```css
transition: background-color 150ms ease;
```

### linear (Rare)

Only for: constant-speed animations (marquees, tickers), time visualization (progress bars, hold-to-delete indicators). Linear feels robotic for interactive elements.

### ease-in (Almost Never)

**Avoid for UI.** The slow start delays visual feedback, making interfaces feel sluggish. A dropdown with `ease-in` at 300ms *feels* slower than `ease-out` at the same duration.

**Resources**: [easing.dev](https://easing.dev/), [easings.co](https://easings.co/)

---

## Spring Animations

**Pick spring OR tween globally, not per-component.** Mixing in the same app reads as inconsistent. Document the choice in the project's design doc.

Springs feel natural because they simulate real physics — no fixed duration, they settle based on physical parameters.

### When to Use Springs

- Drag interactions with momentum
- Elements that should feel "alive" (Dynamic Island)
- Gestures that can be interrupted mid-animation
- Mouse-tracking decorative interactions (use `useSpring` to interpolate)

### Configuration

**Apple's approach (recommended — easier to reason about):**
```js
{ type: "spring", duration: 0.5, bounce: 0.2 }
```

**Traditional physics (more control):**
```js
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

### Spring Rules

- **Keep bounce subtle (0.1-0.3)** when used; avoid in most UI contexts
- **Use springs for interruptible gestures** — they maintain velocity when interrupted (CSS animations restart from zero)
- **Balanced parameters**: `stiffness: 500, damping: 30` settles quickly; `stiffness: 1000, damping: 5` is too bouncy
- **Drag release**: `{ type: "spring", velocity: info.velocity.x }` preserves input energy
- **Never bounce or elastic easing curves** — they feel dated and draw attention to the animation itself

### Quick Spring Presets

| Use Case | Config |
|----------|--------|
| Cards/containers (smooth settle) | `stiffness: 300, damping: 30` |
| Pop-ins/badges (snappy) | `stiffness: 500, damping: 25` |
| Slides/entrances (balanced) | `stiffness: 350, damping: 28` |
| Drag release | `stiffness: 500, damping: 30` + velocity |

---

## Timing & Duration

| Element | Duration |
|---------|----------|
| Button press, micro-feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-300ms |
| Page transitions | 300-400ms |
| Entrance choreography (marketing) | 500-800ms |

**Rules:**
- UI animations stay under 300ms
- Exit animations ~75% of enter duration
- Stagger delays 30-80ms between items (never exceed 50ms per item in lists)
- A faster-spinning spinner makes loading *feel* faster — perceived performance matters

### The Frequency Principle

| Frequency | Animation Level |
|-----------|----------------|
| 100+ times/day (keyboard shortcuts, command palette) | **None. Ever.** |
| Tens of times/day (hover, list navigation) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare/first-time (onboarding, celebrations) | Can add delight |

### Asymmetric Enter/Exit

Pressing should be slow when deliberate (hold-to-delete: 2s linear), but release always snappy (200ms ease-out). Slow where user decides, fast where system responds.

```css
/* Release: fast */
.overlay { transition: clip-path 200ms ease-out; }
/* Press: slow and deliberate */
.button:active .overlay { transition: clip-path 2s linear; }
```

---

## Animation Principles (Adapted for Web)

1. **Timing**: User-initiated animations complete within 300ms. Similar elements use identical timing.
2. **Easing**: ease-out for entrances, ease-in-out for movement, never linear for motion.
3. **Squash & Stretch**: Subtle only (0.95-1.05 range). Scale to `0.98` on tap, not `0.8`.
4. **Anticipation**: Button press scale-down before action. Hold-to-delete fills before deleting.
5. **Staging**: One focal point at a time. Modal backgrounds dim to direct focus. Respect z-index hierarchy.
6. **Follow Through**: Springs naturally overshoot-and-settle. Don't add artificial bounce.
7. **Slow In/Slow Out**: This IS easing — ease-in-out for natural movement.
8. **Arcs**: Drag gestures follow natural curves, not rigid straight lines.
9. **Secondary Action**: Backdrop fades while modal slides. Icon rotates while text changes.
10. **Exaggeration**: Subtle emphasis (1.02-1.05 scale on hover, not 1.2).
11. **Solid Drawing**: Consistent transform-origin. 3D transforms use `preserve-3d`.
12. **Appeal**: Cohesive motion personality. Match easing/timing to brand mood.

---

## Exit Animations

### Rules for Presence-Based Animation
- **Conditional rendering** should support exit animations, not just entry
- **Exit mirrors initial** for symmetry: if entering from `opacity: 0, y: 20`, exit to the same
- **Unique keys** (not index) for dynamic lists — enables smooth add/remove
- **Wait modes nearly double perceived duration** — use shorter durations when sequencing enter/exit
- **Disable interactions on exiting elements** — they're visually present but logically gone
- **List reordering** needs layout animation mode, not sequential mode

---

## Stagger Animations

Cascading effects where multiple elements enter with small delays between each:

```css
.item {
  opacity: 0;
  transform: translateY(8px);
  animation: fadeIn 300ms ease-out forwards;
}
.item:nth-child(1) { animation-delay: 0ms; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }

@keyframes fadeIn {
  to { opacity: 1; transform: translateY(0); }
}
```

- **30-80ms between items** (50ms max per item)
- Stagger is decorative — **never block interaction** while playing
- Marketing pages can use longer staggers (100-150ms) with more dramatic entrance

---

## clip-path Animations

`clip-path` is a powerful animation tool, not just for shapes.

### Inset Shape
```css
/* Fully hidden from right */
.hidden { clip-path: inset(0 100% 0 0); }
/* Fully visible */
.visible { clip-path: inset(0 0 0 0); }
```

### Patterns
- **Hold-to-delete**: Overlay with `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` over 2s linear on `:active`, snap back 200ms ease-out on release
- **Tab color transitions**: Duplicate tab list styled as "active", clip to show only active tab, animate clip on change
- **Image reveals on scroll**: `inset(0 0 100% 0)` → `inset(0 0 0 0)` with IntersectionObserver
- **Comparison sliders**: Clip top image, adjust right inset on drag

---

## Debugging Animations

1. **Record and replay** frame by frame — reveals invisible details
2. **Slow motion**: Increase duration 2-5x, or use DevTools animation inspector
3. **Check in slow motion**: colors transition smoothly? easing feels right? transform-origin correct? properties in sync?
4. **Test on real devices** for touch interactions — connect phone via USB
5. **Review with fresh eyes** the next day — you notice imperfections after stepping away
6. **Fix shaky animations**: `will-change: transform` keeps element on GPU

---

## Hardware / Compositor Gotchas

For compositor/GPU-acceleration gotchas (shorthand props, `will-change` lifecycle, `transform`/`opacity`-only), see `performance.md`.

---

## Animation-Specific Interaction Rules

- **Interaction feedback ≤ 100ms** — if it takes longer, it stops feeling like a reaction
- **Hover contract** — transform + color + shadow move together, never just one property
- **Disable interactions on exiting elements** — visually present, logically gone
- **Never block interaction while a stagger plays** — decorative motion must not gate input

General interaction rules (keyboard, focus, touch targets, `overscroll-behavior`, `touch-action`, optimistic UI, destructive confirmations) live in `accessibility.md` — honor them on every animated control.

---

## Decision Rules (expanded)

1. **Justify every animation** — motion must communicate something (hierarchy, state, spatial relationship). Decorative motion is noise.
2. **Frequency determines budget** — 100+ times/day gets zero animation. Occasional (modals, drawers) get standard. First-time experiences can delight.
3. **Speed communicates confidence** — under 200ms feels instant. 300ms+ starts feeling sluggish.
4. **Respect the user's system** — `prefers-reduced-motion` is not optional. Provide meaningful fallbacks, not just `animation: none`.
5. **GPU-only properties** — stick to `transform` and `opacity`. Animating `width`, `height`, `top`, `left` causes layout thrashing.
6. **List properties explicitly** — `transition: all` animates things you didn't intend.

---

## @starting-style

For enter-animation-on-mount using `@starting-style`, see `modern-css.md`.
