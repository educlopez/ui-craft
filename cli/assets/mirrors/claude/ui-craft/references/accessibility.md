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

---

## Quick Checklist

Every UI you build or review must pass these:

- [ ] `prefers-reduced-motion` respected on every animation — with meaningful fallbacks:
  - Fade+slide entrance → just appear instantly (`opacity: 1`, no transform)
  - Spring/bounce → simple opacity fade (`200ms ease`)
  - Parallax scroll → static positioning
  - Color and opacity transitions are fine to keep — they don't cause motion sickness
- [ ] `@media (hover: hover) and (pointer: fine)` gates hover animations
- [ ] All interactive elements keyboard-reachable with visible focus
- [ ] Icon-only buttons have `aria-label`; decorative icons are `aria-hidden`
- [ ] Focus trapped in modals; restored to trigger on close
- [ ] Color is never the sole status indicator
- [ ] Touch targets ≥ 44px (use pseudo-element expansion)
- [ ] Native elements (`button`, `a`, `label`) before ARIA roles
- [ ] Form errors linked via `aria-describedby`, invalid fields use `aria-invalid`
- [ ] Skip-to-content link; hierarchical `<h1>`–`<h6>`

---

## Forms (Non-negotiable)

- **Never block paste** in inputs
- **Enter submits** focused input; ⌘/Ctrl+Enter in multi-line fields
- **Keep submit enabled** until request starts; then disable with spinner and keep label
- **Accept free text, validate after** — don't block typing
- **Errors inline next to fields**; on submit, focus first error
- **Set `autocomplete` + meaningful `name`**; correct `type` and `inputmode`
- **Warn on unsaved changes** before navigation
- **Trim values** to handle trailing whitespace from text expansion
- **Mobile input font-size ≥ 16px** to prevent iOS zoom
