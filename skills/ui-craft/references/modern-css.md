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
