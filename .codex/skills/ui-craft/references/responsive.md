# Responsive & Adaptive Design

Adaptation is not just scaling — it's rethinking for each context.

---

## Breakpoint Strategy: Content-Driven (Preferred)

Add breakpoints where the content breaks, not at conventional device widths. Container queries are the preferred mechanism — components respond to their container, not to the viewport.

```css
.card-container { container-type: inline-size; }

@container (min-width: 400px) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

Use fluid sizing to eliminate most breakpoints entirely:

```css
/* Fluid font: 16px at 320px → 20px at 1200px */
font-size: clamp(1rem, 0.5rem + 1.5vw, 1.25rem);

/* Fluid spacing */
padding: clamp(1rem, 2vw, 3rem);
```

For full container query patterns — style queries, named containers, when to prefer container over media queries — see [modern-css.md](modern-css.md).

---

## Breakpoint Strategy: Device Reference (Fallback)

When the project's existing system uses device breakpoints, match it. The conventional ranges:

- Mobile: < 768px
- Tablet: 768–1023px
- Desktop: 1024px+

Use these only when integrating with an existing system. New code should prefer container queries (see above).

### Verify Coverage

- Mobile, tablet, laptop, ultra-wide
- Portrait AND landscape
- Different browsers (Safari, Chrome, Firefox)
- iOS Low Power Mode, macOS Safari

---

## Mobile Adaptation (Desktop → Mobile)

### Layout
- Single column (not multi-column)
- Vertical stacking
- Full-width components
- Bottom navigation (not top/side)

### Interaction
- Touch targets **44x44px minimum**
- Swipe gestures where appropriate
- Bottom sheets instead of dropdowns
- **Thumbs-first design** — controls within thumb reach
- More spacing between interactive elements

### Content
- **Progressive disclosure** — don't show everything at once
- Secondary content in tabs/accordions
- Shorter, more concise text
- Minimum **16px font size** (prevents iOS zoom)

### Navigation
- Hamburger or bottom nav
- Reduce complexity
- Sticky headers for context
- Back button in flows

---

## Tablet Adaptation

- Two-column layouts (not single or three)
- Master-detail views (list + detail)
- Adaptive per orientation (portrait vs landscape)
- Support both touch and pointer
- Touch targets 44px but allow denser layouts than phone

---

## Desktop Adaptation (Mobile → Desktop)

### Layout
- Multi-column (use horizontal space)
- Side navigation: always visible on desktop (1024px+). On tablet (768–1023px): collapse to icon rail or persistent narrow sidebar. On mobile: collapse to a drawer or bottom-nav pattern. **Why:** primary navigation must remain discoverable; visible-by-default at desktop trades screen real estate for discoverability, while mobile trades discoverability for content room — both are correct in their context.
- Multiple information panels
- Max-width constraints (don't stretch to 4K)

### Interaction
- Hover states for additional info
- Keyboard shortcuts
- Right-click context menus
- Drag and drop, multi-select with Shift/Cmd

### Content
- Show more info upfront (less progressive disclosure)
- Data tables with many columns
- Richer visualizations

---

## Responsive Grid (No Breakpoints)

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}
```

---

## Responsive Images

```html
<picture>
  <source media="(min-width: 768px)" srcset="large.webp">
  <img src="small.webp" alt="..." width="600" height="400" loading="lazy">
</picture>
```

---

## Safe Areas

```css
.fixed-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Print Adaptation

- Remove navigation, footer, interactive elements
- Page breaks at logical points
- Expand shortened content (show full URLs)
- Black and white or limited color
- Add page numbers, headers, print date

---

## Never

- Don't hide core functionality on mobile — feature parity is the floor; if a feature is too complex for mobile, redesign the feature, don't hide it.
- Don't assume touch only on mobile — tablets and 2-in-1 laptops blur the line; design pointer-agnostic.
- Don't forget landscape orientation — mobile in landscape and tablet in portrait often have similar dimensions and need similar treatment.
- Don't ship horizontal scroll at any breakpoint without an explicit scroll affordance — accidental horizontal scroll is the most common AI-template responsive failure.
