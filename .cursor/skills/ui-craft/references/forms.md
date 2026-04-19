# Forms — System Design

Holistic form design: timing, placement, progressive disclosure, multi-step flows, autosave, optimistic submit, keyboard contract, and field-specific patterns. Input labels and ARIA requirements live in `accessibility.md`; error message tone lives in `copy.md`. This file is the system that ties those tactical pieces together.

---

## When to Read This

Read when building any form longer than 2 fields, any multi-step flow, any form with conditional logic, any surface with autosave, or any destructive confirmation. A single search input doesn't need this file; a checkout, onboarding, settings page, or record editor does.

---

## Validation Timing

The most-botched decision in form UX. Wrong timing feels punitive; right timing feels invisible.

| Trigger | When to use | When not to |
|---------|-------------|-------------|
| On blur | Format-checkable fields (email, URL, credit card, phone) | Required-only check — don't punish leaving a field |
| On submit | Required fields, inter-field dependencies, server-side uniqueness | Format checks that could fire earlier |
| Inline (as-you-type) | Password strength, character count, username availability | Email format (too noisy); most other fields |
| On mount | Never | Ever |

**Rules:**
- Validate on blur only after the user has interacted with the field at least once. Never validate on mount — nothing is wrong yet, and red borders on a fresh form read as hostile.
- Inline validation requires a debounce (~300ms) to avoid flickering errors while typing.
- Server-side uniqueness checks (username, slug) show a tiny spinner in the field during the check, then a green check or red error on resolve.
- On submit, surface ALL errors at once, not one at a time. Users want to fix everything in one pass.

---

## Error Placement

Where error messages live on the page. Details on copy tone are in `copy.md`.

- **Below the input, not above.** Users read top-to-bottom; the error follows the field it describes.
- **Red border on the input itself**, plus message, plus icon (`⚠` or field-specific). Color alone fails WCAG and color-blind users — pair color with shape/text.
- **Scroll to first error on submit** if not in view. Focus it so screen readers announce it immediately.
- **Summary at the top is additive, not a replacement.** For long forms, an aria-live summary box ("3 fields need attention") helps — but every field still has its own inline error.
- **Never remove an error until the user changes the field.** Clearing it on re-focus without re-validation hides the problem.

---

## Progressive Disclosure

Show fields only when relevant. A form with 20 visible fields reads as homework; the same form with 6 visible and 14 revealed-on-relevance feels considerate.

- **Conditional fields appear smoothly** — use `animation-timeline` or a 200ms height/opacity transition, not a pop-in. See `modern-css.md` for `interpolate-size: allow-keywords`.
- **Group related fields under a shared section header** — billing address separate from shipping address separate from payment.
- **Optional fields behind a "More options" toggle** if there are more than 2. Most users don't need them; showing them upfront adds cognitive load for no gain.
- **Never show 20 fields at once.** The form looks abandoned before the user starts.
- **Conditional reveal is one-way** until submit — don't hide a field the user has filled, even if the condition changes. Instead, disable it with a note.

---

## Multi-Step / Wizard Patterns

When a form is too long for one screen, or the steps represent logical phases (account → plan → payment → confirm).

- **Progress indicator.** Numbered steps + current/total + short label per step. Not just "Step 3 of 5" — "Step 3 of 5: Payment."
- **Back button always available.** Moving back preserves all state; never re-fetch or reset.
- **Forward gated by current-step validity.** The "Next" button disables until required fields are valid — with a tooltip/inline message explaining what's missing.
- **Save draft automatically** between steps. See Autosave below.
- **Resume on return.** If the user leaves and comes back, restore to the last completed step, not step 1.
- **Review step before final submit.** Summary of all entries grouped by section, with an "Edit" link per section that jumps back to that step and returns. Users catch their own errors cheaper than servers do.
- **Never more than ~5 steps.** See Miller's Law in `heuristics.md` — beyond 5, the user loses the map.

---

## Save-Draft / Autosave

For any form that takes longer than ~30 seconds to fill.

- **Debounce 1-2s** after the last keystroke, not per keystroke.
- **Visible "Saved" indicator with timestamp** — "Saved 2s ago" near the fields, quiet typography. Match `copy.md` restraint: "Saved" beats "Your draft has been saved successfully!"
- **Network loss.** Show "Reconnecting… Your draft is safe locally" and queue the save. When back online, sync and update the indicator.
- **Conflict resolution.** If another tab or user edited the same resource, offer "Keep mine / Keep theirs / Merge." See `state-design.md` for the conflict-state pattern.
- **Never show a spinner for autosave.** The whole point is invisibility. A check mark or timestamp is enough.

---

## Optimistic Submit

Forms that look instant. Use for low-risk writes (likes, toggles, comment posts, small field edits).

- **Show success state immediately on submit** — don't wait for server ack.
- **Roll back with a clear undo prompt if the server rejects.** "Couldn't save — undo or retry?" Never silently revert.
- **Queue on offline; sync on reconnect** with a visible indicator.
- **Never double-submit.** Disable the button OR swap its label to "Sending…" with a spinner inside. Both — belt and suspenders.
- **Non-optimistic submits** (payments, destructive actions, high-stakes writes) — always wait for server confirmation before showing success.

---

## Keyboard Affordances

Basics most forms miss. The keyboard contract is non-negotiable on any form a user will fill more than once.

- **Enter submits from any single-line input.** Textareas get `Cmd/Ctrl + Enter` for submit; plain Enter inserts a newline.
- **Tab order matches visual order.** No DOM-order surprises. Never `tabindex > 0` to hack the order — fix the DOM.
- **Submit button is focus-reachable** without `tabindex` tricks.
- **Escape closes form modals** and prompts a "Discard changes?" if the form is dirty.
- **Autofocus the first field on form open** — but with caveats on mobile (may trigger the keyboard to pop up before the user sees the form). Test on real devices; consider autofocus only on desktop.
- **Cmd/Ctrl + S saves** on long-form editors. Common expectation from native apps.

---

## Field-Specific Patterns

The fields that AI-generated forms get wrong.

| Field | Pattern |
|-------|---------|
| Phone | Country code picker + mask + formatted display. Store E.164 internally; display local format ("(415) 555-1234") |
| Date | Prefer native `<input type="date">` where UX is tolerable. For ranges or complex pickers, a dedicated accessible component |
| Time zone | Pre-fill from browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`); let user override; display user-facing name ("9:00 AM PT") not IANA ID |
| Credit card | Autoformat with a space every 4 digits; detect brand from first digits; move focus to expiry when card number is valid |
| Currency | Format per locale via `Intl.NumberFormat`; never let users type the currency symbol — render it as a prefix affordance |
| Password | Show/hide toggle (eye icon + `aria-label`). Strength indicator relative, not absolute. Skip the "1 uppercase, 1 number, 1 special" dance unless compliance requires it — long is better than complex |
| Magic link | "Check your email" state with explicit "Didn't receive? Resend in 30s" countdown; cooldown visible |
| File upload | Drag-and-drop with dashed border indicator on drag-over; per-file progress (bar + filename + size + cancel); per-file retry on failure; `accept` hints + descriptive copy ("PDF, PNG, JPG up to 10MB") |

---

## Destructive Actions Inside Forms

Deleting accounts, subscriptions, workspaces, or data from within a settings form.

- **Separate section** — a "Danger zone" or "Delete account" block, visually distinct, usually at the bottom.
- **Warning tone, not shaming.** See `copy.md` Banned Patterns — no confirmshaming.
- **Type-to-confirm.** Require the user to type the resource name for deletion: "Type `my-project` to confirm."
- **30-day grace period visible** where applicable — "You'll have 30 days to restore this from Trash."
- **Show consequences upfront.** "You'll lose: 47 projects, all API keys, access for 12 team members."
- **Never the primary-button-style** — the delete button uses a danger color, and the safe button (Cancel) is the primary.

---

## Anti-Patterns

Form sins that invalidate the rest of the work:

- **Placeholder as the only label.** Disappears on focus → user forgets what the field was. Accessibility and memory fail.
- **Required asterisks without a legend.** User doesn't know `*` means required unless you say so somewhere visible.
- **Red validation on mount.** Nothing is wrong yet — don't punish arrival.
- **Disabled submit button with no explanation.** User can't fix what they can't see. Tooltip or inline hint explains what's missing.
- **Clearing the whole form on one error.** Preserve every valid field; only reset the invalid one.
- **Captcha before form submission.** Captcha runs after the user expressed intent, not before.
- **"Are you sure?" after every step** in a wizard. Users desensitize and click through; save the confirm for the last, destructive moment.
- **Reset button next to submit.** Users accidentally click it. Almost never worth shipping.
- **Two password fields** ("confirm password") without a show/hide toggle. Everyone types the same typo twice.
- **Blocking paste** on any field — especially password confirm, order IDs, credit cards. See `accessibility.md`.

---

## Cross-References

- `accessibility.md` — ARIA, label requirements, keyboard non-negotiables, `aria-describedby` for errors.
- `copy.md` — voice/tone across form states, reading level, locale-aware strings, inclusive language, error message tone, empty states, CTA discipline.
- `state-design.md` — form states (idle / submitting / success / error / partial / offline); autosave conflict state.
- `heuristics.md` — Error Prevention heuristic, Miller's Law for step counts, Tesler's Law for progressive disclosure.
- `modern-css.md` — `interpolate-size: allow-keywords` for revealed fields, `<dialog>` for confirm modals, Anchor Positioning for inline help popovers.
