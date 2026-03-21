# Responsive & Adaptive Design

Adaptation is not just scaling — it's rethinking for each context.

---

## Breakpoint Strategy

### Content-Driven (Preferred)
Set breakpoints where the design actually breaks, not at arbitrary device widths.

### Device Reference
- **Mobile**: 320px-767px
- **Tablet**: 768px-1023px
- **Desktop**: 1024px+
- **Ultra-wide**: test at 50% zoom to simulate

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
- Side navigation always visible
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

## Technical Implementation

### Container Queries (Component-Level)
```css
.card-container { container-type: inline-size; }

@container (min-width: 400px) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

### Fluid Sizing
```css
/* Fluid font size: 16px at 320px, 20px at 1200px */
font-size: clamp(1rem, 0.5rem + 1.5vw, 1.25rem);

/* Fluid spacing */
padding: clamp(1rem, 2vw, 3rem);
```

### Responsive Grid (No Breakpoints)
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}
```

### Responsive Images
```html
<picture>
  <source media="(min-width: 768px)" srcset="large.webp">
  <img src="small.webp" alt="..." width="600" height="400" loading="lazy">
</picture>
```

### Safe Areas
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
- Hide core functionality on mobile
- Assume desktop = powerful device
- Use different information architecture across contexts
- Break platform expectations
- Forget landscape orientation
- Use generic breakpoints blindly
- Ignore touch on desktop (many desktops have touchscreens)
- Use `display: none` carelessly (still downloads content)
