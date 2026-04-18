# Animation & Rendering Performance

Fix jank, dropped frames, and layout thrashing.

---

## Core Rules

Apply to all UI work:

- **Virtualize large lists** (>50 items)
- **Preload above-fold images**; lazy-load the rest
- **Explicit image dimensions** to prevent CLS
- **Preconnect** to CDN domains
- **Track re-renders** — minimize and make them cheap
- **Batch layout reads/writes** — never interleave
- **Mutations** target <500ms
- **Prefer CSS > Web Animations API > JS libraries** for animations

---

## Rendering Pipeline

```
Layout (expensive) → Paint (moderate) → Composite (cheap)
```

- **Composite only**: `transform`, `opacity` — GPU-accelerated, off main thread
- **Paint**: `color`, `borders`, `gradients`, `masks`, `images`, `filters`
- **Layout**: `width`, `height`, `top`, `left`, `margin`, `padding`, `flex`, `grid`

---

## Critical Rules (Never Patterns)

1. **Never interleave layout reads and writes** in the same frame (layout thrashing)
2. **Never animate layout properties continuously** on large surfaces
3. **Never drive animation from `scrollTop`/`scrollY`/scroll events** — use Scroll Timelines
4. **No `requestAnimationFrame` loops without stop condition**
5. **Never mix animation systems** that each measure or mutate layout
6. **Never `transition: all`** — list properties explicitly

---

## Mechanism Selection

| Preference | When |
|-----------|------|
| **CSS transitions/animations** | Simple, predetermined — runs off main thread |
| **Web Animations API (WAAPI)** | Programmatic control with CSS performance |
| **JS (Motion, GSAP)** | Dynamic, interruptible, gesture-driven |

```js
// WAAPI: hardware-accelerated, interruptible, no library
element.animate(
  [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
  { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
);
```

### Animation Library Caveat

Some libraries use shorthand props (`x`, `y`, `scale`) that run via `requestAnimationFrame` on main thread — **NOT hardware-accelerated**. Always verify your library promotes to the compositor. When in doubt, use explicit `transform` strings.

```js
// May drop frames under load (shorthand)
animate({ x: 100 })

// Hardware accelerated (explicit transform)
animate({ transform: "translateX(100px)" })
```

---

## FLIP Pattern

Measure once, animate via transform:

```js
// 1. First: measure current position
const first = el.getBoundingClientRect();

// 2. Last: apply final state
el.classList.add('moved');
const last = el.getBoundingClientRect();

// 3. Invert: calculate delta, apply transform
el.style.transform = `translateX(${first.left - last.left}px)`;

// 4. Play: remove transform with transition
requestAnimationFrame(() => {
  el.style.transition = 'transform 0.3s';
  el.style.transform = '';
});
```

---

## Scroll-Linked Motion

### Prefer: CSS Scroll Timelines
```css
.reveal {
  animation: fade-in linear;
  animation-timeline: view();
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Prefer: IntersectionObserver for visibility
```js
const observer = new IntersectionObserver(
  entries => entries.forEach(e => e.target.classList.toggle('visible', e.isIntersecting)),
  { threshold: 0.1, rootMargin: '-100px' }
);
```

### Never:
- Poll scroll position for animation
- Use `scroll` event listeners for continuous animation
- Trigger continuous layout/paint on large surfaces during scroll

---

## Layers & Promotion

- **Compositor motion requires layer promotion** — never assume it
- **`will-change` temporarily and surgically** — add before animation, remove after
- **Avoid many/large promoted layers** — each consumes GPU memory
- **Validate with DevTools** Layers panel when performance matters

```css
/* Temporary promotion */
.animating { will-change: transform; }

/* Remove after animation */
.done { will-change: auto; }
```

---

## Blur & Filters

- **Keep blur ≤ 8px** for animation (≤ 20px for static)
- **Short, one-time effects only** — never continuous
- **Never on large surfaces** — extremely expensive, especially Safari
- **Prefer opacity + translate** before reaching for blur
- **`backdrop-filter`** is expensive — avoid animating it

---

## CSS Variables

- **Changing a CSS variable on parent recalculates ALL children** — expensive on deep trees
- **Update `transform` directly** on the element instead:

```js
// Bad: triggers recalc on all children
element.style.setProperty('--swipe-amount', `${distance}px`);

// Good: only affects this element
element.style.transform = `translateY(${distance}px)`;
```

- **Scope animated variables locally** and avoid inheritance
- **Never animate inherited CSS variables**

---

## General Performance

- **Virtualize large lists** (>50 items) — use a virtualization library or `content-visibility: auto`
- **Preload above-fold images**; lazy-load the rest
- **Explicit image dimensions** to prevent CLS
- **`<link rel="preconnect">`** for CDN domains
- **Preload critical fonts** with `font-display: swap`; subset to used code points
- **Track re-renders** with your framework's profiling tools
- **Profile with CPU/network throttling**
- **Test iOS Low Power Mode and macOS Safari**
- **Mutations target <500ms** (POST/PATCH/DELETE)
- **Move expensive work to Web Workers**
- **Pause looping animations when off-screen**

---

## View Transitions Performance

- Use **only for navigation-level changes** (page transitions)
- **Avoid for interaction-heavy UI** — interruptibility is limited
- **Size changes are potentially layout-triggering**
- View transition names must be **unique during transition** and **cleaned up after**
