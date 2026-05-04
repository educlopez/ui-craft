# Modern CSS Capabilities

CSS capabilities that unlock interaction patterns otherwise requiring JS: View Transitions, CSS Scroll Timelines, Anchor Positioning, Container Queries, `@starting-style`, allow-keywords. Each section: when to reach for the API, what principle it encodes, and the rules that follow from the principle.

---

## View Transitions API

View Transitions preserve scroll position and focus across navigations because the browser captures both before and after states as snapshots, eliminating the layout thrashing and focus loss that hand-rolled JS transitions cause. The browser handles the morph; you name the elements that should persist.

**Use View Transitions when:** DOM identity is preserved across views — App Router page transitions, list-to-detail flows where the same element exists on both sides of the navigation.

**Don't use View Transitions for:** modal overlays (use `@starting-style` + `display: block` allow-keywords instead), in-page state transitions (use CSS Scroll Timelines or simple transitions), tab-switching within the same page (no view boundary).

### Basic Usage
```js
document.startViewTransition(() => {
  // Update DOM here
  updatePage();
});
```

### Named Transitions
```css
/* Source element */
.card-image { view-transition-name: card-hero; }

/* Style the transition */
::view-transition-group(card-hero) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
}
```

### Rules

Each `view-transition-name` must be unique at the moment the transition fires — two elements sharing the same name will cause the transition to fail silently. Names are a handshake between the before and after state; clean them up so stale names don't leak across navigations.

- Each `view-transition-name` must be **unique during transition**
- **Clean up names** after transition completes:
```js
sourceImg.style.viewTransitionName = "card";
document.startViewTransition(() => {
  sourceImg.style.viewTransitionName = "";
  targetImg.style.viewTransitionName = "card";
});
```
- Use **only for navigation-level changes** — avoid for rapid interactions
- Interruptibility is limited — avoid for interaction-heavy UI
- Prefer over JS animation libraries for page transitions

---

## @starting-style

`@starting-style` defines the element's style on first paint, before the browser computes the transition. Without it there is no "from" state for a newly mounted element — the browser skips the transition entirely. This replaces the `useEffect` → `setMounted(true)` → `data-mounted` pattern with a single CSS block.

```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;

  @starting-style {
    opacity: 0;
    transform: translateY(100%);
  }
}
```

Baseline 2024. Pair with `transition-behavior: allow-discrete` when the element toggles `display`.

---

## CSS Scroll Timelines

Scroll Timelines drive animations from scroll position rather than time, running off the main thread with zero scroll event listeners. The timeline replaces the clock — the progress of the scroll IS the animation progress.

### Scroll-Linked
```css
.progress-bar {
  animation: grow linear;
  animation-timeline: scroll();
}

@keyframes grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
```

### View-Linked (element entering viewport)
```css
.reveal {
  animation: fade-in linear;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Rules

Scroll Timelines exist because polling `scrollY` or attaching scroll event listeners for continuous animation causes layout/paint work on every frame — a Scroll Timeline runs on the compositor thread and costs nothing. Reserve IntersectionObserver for one-shot visibility triggers (wider support, no continuous callback overhead).

- Prefer Scroll/View Timelines over JS for scroll-linked motion
- Never poll scroll position for animation
- Never use `scroll` event listeners for continuous animation
- Use IntersectionObserver for visibility/pausing (wider support)

---

## Container Queries

A component's layout should respond to the space it occupies, not the viewport. Viewport media queries break reusable components because the same component in a sidebar and in main content hits the same breakpoints even though the available space is completely different. Container queries fix the unit of measure.

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card { display: grid; grid-template-columns: 1fr 2fr; }
}

@container card (max-width: 399px) {
  .card { display: flex; flex-direction: column; }
}
```

---

## Pseudo-Elements

`::before` and `::after` add a layer of styling surface without extra DOM nodes. The most useful application is interactive state overlays — placing a pseudo-element between the element's background and content lets hover/focus states change the overlay without affecting surrounding elements. Hit target expansion is the other dominant use case: extend the interactive area without changing the visible element.

### Decorative Content (::before / ::after)
```css
/* Background effect without extra DOM */
.button {
  position: relative;
  z-index: 1;
}
.button::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--gray-3);
  z-index: -1;
  border-radius: inherit;
  transition: background 150ms ease;
}
.button:hover::before {
  background: var(--gray-4);
}
```

### Hit Target Expansion
```css
.small-icon-button {
  position: relative;
}
.small-icon-button::before {
  content: "";
  position: absolute;
  inset: -8px -12px;  /* Expand clickable area */
}
```

### Rules

- `::before`/`::after` **require `content` property** to render
- Parent must have `position: relative` for absolute pseudo-elements
- Pseudo-elements need `z-index` for proper layering
- **Use pseudo-elements for decoration** — don't add extra DOM nodes
- Native variants: `::backdrop` (dialog/popover backgrounds), `::placeholder` (input text), `::selection` (highlighted text)

---

## clip-path for Animation

`clip-path: inset()` is the cleaner alternative to animating `width` or `height` for reveal effects — it composites, doesn't reflow, and accepts fractional values. Four inset values map to top/right/bottom/left clipping edges; animate between them for directional reveals.

```css
.hidden  { clip-path: inset(0 100% 0 0); }  /* clipped from right */
.visible { clip-path: inset(0 0 0 0);    }  /* fully visible */
.element { transition: clip-path 200ms ease-out; }
```

Patterns: hold-to-delete (2s linear on `:active`), tab transitions, image reveals on scroll, comparison sliders. In all cases the visible-state value is `inset(0 0 0 0)` — vary the hidden-state edge to control direction.

---

## Useful Modern Properties

| Property | Use |
|----------|-----|
| `text-wrap: balance` | Balanced line lengths for headings |
| `text-wrap: pretty` | Better line breaks for body text |
| `font-variant-numeric: tabular-nums` | Aligned numbers in tables/data |
| `overscroll-behavior: contain` | Prevent scroll chaining in modals |
| `scroll-margin-top` | Offset for anchor links with sticky headers |
| `content-visibility: auto` | Lazy-render off-screen content |
| `color-scheme: dark` | Native dark mode for scrollbars/forms |
| `accent-color` | Style form controls (checkboxes, radios) |

---

## Anchor Positioning

Anchor Positioning replaces JS-driven popover positioning — no `getBoundingClientRect()`, no resize observers, no coordinate math. The browser owns the placement and handles viewport overflow through declarative fallback chains. Baseline 2026 (Firefox 147, Safari 26, Chrome 125+). Kills the Floating UI dependency for most cases; pair with the Popover API for a fully declarative menu.

```css
.button {
  anchor-name: --trigger;
}

.popover {
  position: absolute;
  position-anchor: --trigger;
  position-area: bottom center;  /* one-line placement */
  margin-top: 8px;
}

/* Fallback if there's no room below */
@position-try --top {
  position-area: top center;
  margin-top: 0;
  margin-bottom: 8px;
}

.popover {
  position-try-fallbacks: --top;
}
```

### Rules

Anchor names are scoped to their containing block by default — explicitly declare `position-anchor` in nested contexts to avoid resolution ambiguity. Always define a fallback so viewport-edge popovers don't clip rather than flip.

- Anchor names are scoped by default; use `position-anchor` explicitly in nested cases
- Always define a `position-try-fallbacks` for viewport-edge cases
- Pair with `<div popover>` for automatic focus and dismiss handling
- Progressive enhancement: feature-detect with `@supports (anchor-name: --x)`, fall back to JS only for older browsers

---

## Popover API + `<dialog>`

The browser already implements focus trapping, ESC handling, and backdrop rendering for modal and non-modal overlays. Building these in JS means reimplementing browser behavior with more code and more failure modes. Use the platform.

```html
<!-- Popover: lightweight menu, tooltip, dropdown -->
<button popovertarget="menu">Open menu</button>
<div id="menu" popover>
  <button>Profile</button>
  <button>Settings</button>
  <button>Sign out</button>
</div>

<!-- Dialog: modal with backdrop -->
<dialog id="confirm">
  <form method="dialog">
    <p>Delete this workspace?</p>
    <button value="cancel">Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```

```js
// Open modal dialog (ESC closes, focus trapped)
document.getElementById('confirm').showModal();
```

### Rules

Native `<dialog>` and `[popover]` enforce correct semantics and ARIA roles automatically — a custom `<div role="dialog">` with manual focus management is always more code for a worse result.

- Use `<dialog>` with `showModal()` for modals — get focus trap + backdrop + ESC for free
- Use `popover` attribute for non-modal overlays (menus, tooltips, combobox panels)
- Pair Popover with Anchor Positioning for placement instead of JS math
- Style `::backdrop` for dim/blur behind modals
- **Anti-pattern:** custom `<div role="dialog">` with manual focus management when `<dialog>` works

---

## `interpolate-size: allow-keywords`

Browsers historically refused to animate to intrinsic sizes (`height: auto`, `width: max-content`) because the value isn't known until layout. `interpolate-size: allow-keywords` opts in to browser-side interpolation of these values, enabling accordion and disclosure patterns without JS measurement. Chrome 129+ as of early 2026; progressive enhancement everywhere else.

```css
:root {
  interpolate-size: allow-keywords;
}

.accordion {
  height: 0;
  overflow: hidden;
  transition: height 300ms var(--ease-out);
}

.accordion[open] {
  height: auto;  /* now animatable */
}
```

### Rules

Set at `:root` so every element in the document inherits the opt-in — scoping it narrower creates inconsistency. The fallback for non-supporting browsers is to measure `scrollHeight` in JS and animate to a pixel value.

- Set `interpolate-size: allow-keywords` at `:root` to opt-in globally
- Works with `height`, `width`, `block-size`, `inline-size` to/from `auto`, `min-content`, `max-content`, `fit-content`
- Fallback for non-supporting browsers: JS measures scroll height and animates to a pixel value
- Respect `prefers-reduced-motion` — snap to final size without transition

---

## `color-mix()` for Theming Derivations

Hand-tuned shade ladders break every time the base token changes. `color-mix()` derives hover, pressed, muted, and ring variants from a single base token — one change propagates through every derived value. Mix in `oklch` for perceptual uniformity; sRGB mixing produces inconsistent lightness shifts across hues.

```css
:root {
  --accent: oklch(62% 0.15 250);
  --surface: oklch(98% 0.005 250);

  --accent-hover:   color-mix(in oklch, var(--accent) 85%, white);
  --accent-pressed: color-mix(in oklch, var(--accent) 85%, black);
  --accent-muted:   color-mix(in oklch, var(--accent) 20%, var(--surface));
  --accent-ring:    color-mix(in oklch, var(--accent) 40%, transparent);
}
```

### Rules

- Mix in `oklch` or `lch` for perceptual uniformity — never `srgb` unless the base is already sRGB
- Same derivation pattern works for semantic palettes: `--success`, `--warning`, `--danger` each get their own hover/pressed/muted
- One base change cascades through every derived token — no ladder to re-tune
- Feature support: Baseline 2024, safe to ship

---

## `transition-behavior: allow-discrete`

CSS transitions skip `display: none` by default because `none` is not a numeric value — there is no midpoint to interpolate. `allow-discrete` tells the browser to hold the element visible through the exit transition before applying `display: none`, enabling fade-out on elements that unmount from the DOM.

```css
.menu {
  display: none;
  opacity: 0;
  transition:
    opacity 200ms var(--ease-out),
    display 200ms allow-discrete;

  @starting-style {
    opacity: 0;
  }
}

.menu:popover-open {
  display: block;
  opacity: 1;
}
```

### Rules

Without `allow-discrete`, popovers and dialogs snap in and out — there is no mechanism to fade them. Without `@starting-style`, the enter keyframe has no "from" state and the element jumps directly to its final state on first paint.

- `allow-discrete` enables transitions on `display`, `visibility`, and custom-property changes
- Combine with `@starting-style` for the enter keyframe — without it, the element jumps to its final state on first paint
- Essential for `<dialog>` and `[popover]` fade/slide animations
- Without it, popovers snap in/out — no way to fade them

---

## Container Queries — Deeper Patterns

Beyond the basic size query. Use for component-level responsiveness where viewport media queries are the wrong tool.

### When to prefer container over media queries

- Component reused across sidebar + main + modal at different widths
- Layout must respond to its slot, not the viewport
- Design system components meant to be dropped into arbitrary layouts

**Anti-pattern:** using `@media (max-width: 768px)` to change a card's layout when the card lives in both a narrow sidebar and a wide main region — the breakpoint fires on both even though only one needs the narrow layout.

### Style queries
```css
.card {
  container-name: card;
  container-type: inline-size;
}

@container card style(--theme: dark) {
  .card__title { color: oklch(95% 0 0); }
}
```

Style queries read custom properties from the container (behind a flag in some browsers as of early 2026; Chrome ships it).

### Named containers for predictable scoping
```css
.sidebar { container-name: sidebar; container-type: inline-size; }
.main    { container-name: main;    container-type: inline-size; }

@container sidebar (min-width: 240px) {
  .nav-item { padding-inline: 12px; }
}

@container main (min-width: 720px) {
  .nav-item { padding-inline: 20px; }
}
```

Same component, different behavior per parent. Viewport media queries can't express this.
