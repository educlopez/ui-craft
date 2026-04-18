# Modern CSS Techniques

View Transitions, scroll-driven animations, container queries, pseudo-elements, and @starting-style.

---

## View Transitions API

Navigate between pages or states with smooth, coordinated transitions.

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

Animate element entry with pure CSS — no JavaScript:

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

Replaces the common `useEffect` → `setMounted(true)` → `data-mounted` pattern. Use when browser support allows.

---

## CSS Scroll Timelines

Tie animations to scroll progress — no JavaScript, no scroll event listeners.

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
- Prefer Scroll/View Timelines over JS for scroll-linked motion
- Never poll scroll position for animation
- Never use `scroll` event listeners for continuous animation
- Use IntersectionObserver for visibility/pausing (wider support)

---

## Container Queries

Adapt components based on their container, not the viewport:

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

Better for reusable components that live in different layout contexts.

---

## Pseudo-Elements

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

### Native Pseudo-Elements
- `::backdrop` — dialog/popover backgrounds
- `::placeholder` — input placeholder styling
- `::selection` — text selection styling

---

## clip-path for Animation

Powerful animation tool beyond just clipping shapes.

### Inset (Rectangular Clipping)
```css
/* Hidden from right */
.hidden { clip-path: inset(0 100% 0 0); }
/* Fully visible */
.visible { clip-path: inset(0 0 0 0); }
/* Transition between them */
.element { transition: clip-path 200ms ease-out; }
```

### Patterns
- **Hold-to-delete**: overlay `inset(0 100% 0 0)` → `inset(0 0 0 0)` over 2s on `:active`
- **Tab transitions**: duplicate tabs, clip to show active, animate on change
- **Image reveals**: `inset(0 0 100% 0)` → `inset(0 0 0 0)` on scroll
- **Comparison sliders**: clip top image, adjust inset on drag

---

## CSS Nesting

Modern CSS supports nesting natively:

```css
.card {
  padding: var(--space-md);

  & .title {
    font-weight: 600;
  }

  &:hover {
    box-shadow: var(--shadow-lg);
  }

  @media (width < 768px) {
    padding: var(--space-sm);
  }
}
```

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

Baseline 2026 (Firefox 147, Safari 26, Chrome 125+). One-line placement for popovers, tooltips, dropdowns, and menus — kills the Floating UI dependency for most cases. Pair with the Popover API for a fully declarative menu.

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
- Anchor names are scoped by default; use `position-anchor` explicitly in nested cases
- Always define a `position-try-fallbacks` for viewport-edge cases
- Pair with `<div popover>` for automatic focus and dismiss handling (see below)
- Progressive enhancement: feature-detect with `@supports (anchor-name: --x)`, fall back to JS only for older browsers

---

## Popover API + `<dialog>`

Native modals and popovers without JS state machines. ESC, focus trap, and backdrop come for free.

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
- Use `<dialog>` with `showModal()` for modals — get focus trap + backdrop + ESC for free
- Use `popover` attribute for non-modal overlays (menus, tooltips, combobox panels)
- Pair Popover with Anchor Positioning for placement instead of JS math
- Style `::backdrop` for dim/blur behind modals
- **Anti-pattern:** custom `<div role="dialog">` with manual focus management when `<dialog>` works

---

## `interpolate-size: allow-keywords`

Animate to `height: auto`, `width: max-content`, and other intrinsic sizes without JS measurement. Chrome 129+ as of early 2026; progressive enhancement everywhere else.

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
- Set `interpolate-size: allow-keywords` at `:root` to opt-in globally
- Works with `height`, `width`, `block-size`, `inline-size` to/from `auto`, `min-content`, `max-content`, `fit-content`
- Fallback for non-supporting browsers: JS measures scroll height and animates to a pixel value
- Respect `prefers-reduced-motion` — snap to final size without transition

---

## `color-mix()` for Theming Derivations

Replace hand-tuned shade ladders with one base token and derived variations. Works in OKLCH for perceptually uniform mixing.

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

Required for smooth enter/exit transitions on elements that toggle `display: none` — popovers, dialogs, and any element that mounts/unmounts in the DOM but wants a fade.

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
- `allow-discrete` enables transitions on `display`, `visibility`, and custom-property changes
- Combine with `@starting-style` for the enter keyframe — without it, the element jumps to its final state on first paint
- Essential for `<dialog>` and `[popover]` fade/slide animations
- Without it, popovers snap in/out — no way to fade them

---

## Container Queries — Deeper Patterns

Beyond the basic size query. Use for component-level responsiveness where viewport media queries are the wrong tool.

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

### When to prefer container over media queries
- Component reused across sidebar + main + modal at different widths
- Layout must respond to its slot, not the viewport
- Design system components meant to be dropped into arbitrary layouts

**Anti-pattern:** using `@media (max-width: 768px)` to change a card's layout when the card lives in both a narrow sidebar and a wide main region — the breakpoint fires on both even though only one needs the narrow layout.
