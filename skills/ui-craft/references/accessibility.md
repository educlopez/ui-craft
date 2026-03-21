# Accessibility

WCAG compliance, keyboard navigation, focus management, ARIA, and forms.

---

## Priority Categories

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Accessible names | Critical |
| 2 | Keyboard access | Critical |
| 3 | Focus & dialogs | Critical |
| 4 | Semantics | High |
| 5 | Forms & errors | High |
| 6 | Announcements | Medium-high |
| 7 | Contrast & states | Medium |
| 8 | Media & motion | Low-medium |

---

## 1. Accessible Names (Critical)

- Every interactive control MUST have an accessible name
- Icon-only buttons: `aria-label` or `aria-labelledby`
- Every input/select/textarea: associated `<label>`
- Links: meaningful text (never "click here")
- Decorative icons: `aria-hidden="true"`

```html
<!-- Icon-only button -->
<button aria-label="Close"><svg aria-hidden="true">...</svg></button>

<!-- Labeled input -->
<label for="email">Email</label>
<input id="email" type="email" />
```

## 2. Keyboard Access (Critical)

- **Never `<div>` or `<span>` as buttons** without full keyboard support — use `<button>`
- All interactive elements reachable by Tab
- Focus visible for keyboard users (`:focus-visible`)
- Never `tabindex > 0`
- Escape closes dialogs/overlays
- Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)

## 3. Focus & Dialogs (Critical)

- Modals MUST trap focus while open
- Restore focus to trigger on close
- Set initial focus inside dialogs
- Opening dialog must not scroll page unexpectedly
- Never `outline: none` without visible focus replacement

## 4. Semantics (High)

- Prefer native elements (`button`, `a`, `input`, `label`, `table`) before ARIA
- If role used, required aria attributes must be present
- Lists use `ul`/`ol` with `li`
- Don't skip heading levels; hierarchical `<h1>`–`<h6>`
- "Skip to content" link
- Tables use `<th>` for headers

## 5. Forms & Errors (High)

- Errors linked to fields via `aria-describedby`
- Required fields announced
- Invalid fields use `aria-invalid="true"`
- Helper text associated with inputs
- On submit, focus first error
- Never block paste
- Disabled states explain why (not just grayed out)

```html
<input id="email" aria-describedby="email-err" aria-invalid="true" />
<span id="email-err">Please enter a valid email address</span>
```

## 6. Announcements (Medium-high)

- Use `aria-live="polite"` for toasts and inline validation
- Loading states use `aria-busy` or status text
- Toasts must not be the only way to convey critical information
- Expandable controls use `aria-expanded` and `aria-controls`

## 7. Contrast & States (Medium)

- APCA contrast preferred over WCAG 2
- Hover-only interactions MUST have keyboard equivalents
- Disabled states don't rely on color alone
- Interactions (`:hover`, `:active`, `:focus`) have MORE contrast than rest state
- Never remove focus outlines without visible replacement

## 8. Media & Motion (Low-medium)

- Images: correct alt text (meaningful or empty `alt=""`)
- Videos with speech: provide captions
- **`prefers-reduced-motion`** on every animation:

```css
@media (prefers-reduced-motion: reduce) {
  .animated { animation: none; transition: none; }
}
```

```jsx
const shouldReduceMotion = useReducedMotion();
const initial = shouldReduceMotion ? false : { opacity: 0, y: 20 };
```

- Gate hover animations:
```css
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); }
}
```

- No autoplaying media with sound

---

## Touch Targets

- Minimum: **44px** (Apple/WCAG recommendation)
- If visual element < 24px, expand hit area with pseudo-element:

```css
.small-button {
  position: relative;
}
.small-button::before {
  content: "";
  position: absolute;
  inset: -8px -12px;
  /* Expands clickable area without changing visual size */
}
```

---

## Color-Blind Safe

- Never rely on color alone for status — include icons/text labels
- Test red/green combinations specifically
- Use color-blind-friendly palettes for charts
- Redundant status cues always
