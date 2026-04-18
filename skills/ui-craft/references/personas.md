# Personas — Walkthrough Checklists

Five personas, five journeys. A heuristic score says what's wrong in the abstract. A persona walkthrough says *who* it breaks for. Use these as overlays on top of `heuristics.md`: same UI, five different lenses.

Each persona has a checklist. Every un-ticked box is a finding. Rank findings using the same impact tags from `heuristics.md` (`blocks-conversion`, `adds-friction`, `reduces-trust`, `minor-polish`).

---

## 1. First-timer Priya

**Tagline:** Never used this product category. Doesn't know what's possible.

**Profile:** 28, mobile-only, moderate English literacy, small-business owner evaluating the product for the first time. Comes in cold from a social ad. Has 90 seconds before she bounces. Doesn't know industry jargon and won't Google it.

**Journey:** Land → understand what the product does → decide whether to sign up → complete signup → reach the "first value" moment (whatever that is for this app).

### Walkthrough checklist

- [ ] Above the fold, I understand what this product does in 5 seconds
- [ ] No jargon on the landing page ("synergy", "orchestrate", "leverage")
- [ ] One primary CTA is obvious — I don't have to hunt for "sign up"
- [ ] Signup asks for the minimum; I'm not giving 8 fields before I see the product
- [ ] Email / Google / Apple auth all work on mobile (no desktop-only flow)
- [ ] After signup, there's a clear next action — not a blank dashboard
- [ ] Empty states tell me what to do: "Create your first X"
- [ ] Terms I don't know have tooltips or inline explanations
- [ ] Error messages explain the problem in plain language
- [ ] If I tap something and nothing happens, I know whether it's loading or broken
- [ ] I can undo my first destructive action
- [ ] The primary value moment is reachable in ≤ 3 steps from signup
- [ ] Help/contact is reachable without leaving the app
- [ ] Keyboard autocorrect doesn't fight the form (autocomplete attrs set)
- [ ] I can pinch-zoom if text is too small

### Red flags

- Landing page uses phrases like "AI-powered orchestration platform" without saying what it does
- Signup form asks for company size / industry / role before account creation
- Dashboard is empty with no "Create your first" CTA
- Tooltips missing on icon-only buttons — she doesn't know what the cog vs wrench means
- Email verification required before she sees any product value

---

## 2. Power User Jordan

**Tagline:** Lives in this tool 4+ hours a day. Expects to fly.

**Profile:** 34, senior ops at a scaleup. Keyboard-first, multiple-monitor, deep domain expertise. Uses the product as a core part of their job. Metrics their own speed — any friction compounds. Will build a userscript or quit the product if workflows feel slow.

**Journey:** Log in → jump straight to a specific record via shortcut or search → perform bulk operations → export/report → jump to the next task.

### Walkthrough checklist

- [ ] Cmd+K (or /) command palette exists and is fast (< 100ms to open)
- [ ] Every common action has a keyboard shortcut, listed in tooltips
- [ ] Tab order is sensible; Shift+Tab reverses; Escape closes
- [ ] Bulk select works on lists of 100+ with Shift-click and Cmd+A
- [ ] Common bulk actions (delete, archive, assign) execute in < 400ms
- [ ] URL state reflects filters / sort / selection so I can bookmark and share
- [ ] I can paginate 1000+ items without virtualized list jank
- [ ] Saved views / segments / filters persist across sessions
- [ ] The app never traps me in a modal I can't Escape out of
- [ ] Destructive actions are undoable, not confirm-blocking (confirms slow me down)
- [ ] Forms submit on Cmd+Enter
- [ ] I can customize columns, hotkeys, or density
- [ ] Paste-to-action works (paste a URL, paste a list of IDs)
- [ ] Export works for the current view, not "everything"
- [ ] No scroll hijacking, no unasked page transitions

### Red flags

- No command palette on a tool users will spend hours in
- Modal-confirm on every delete instead of undo toast
- Lists of 200+ items without bulk select
- Filters reset on navigation — state lives in local React, not URL
- Shortcuts exist but are only discoverable in a hidden help page

---

## 3. Low-bandwidth Adaeze

**Tagline:** 2G cellular, older Android, often offline.

**Profile:** 31, field worker in a region with intermittent connectivity. Budget Android device (4GB RAM, Chrome). Tethers off a phone. Comes in and out of signal throughout the day. Data costs real money per MB.

**Journey:** Open the app on a flaky connection → read or edit a record → queue work while offline → have it sync when reconnected.

### Walkthrough checklist

- [ ] First paint < 3s on simulated 2G (check Lighthouse mobile)
- [ ] Critical CSS inlined; no blocking font load
- [ ] Images have explicit dimensions to prevent layout shift
- [ ] Images are lazy below the fold and use modern formats (WebP/AVIF)
- [ ] Bundle doesn't ship megabytes of unused code
- [ ] Skeletons appear within 200ms so the screen isn't blank
- [ ] Offline state is detected and communicated ("You're offline — changes will sync")
- [ ] Writes are queued locally and reconciled on reconnect
- [ ] Optimistic UI so she doesn't wait for round-trips
- [ ] Error message distinguishes network failure from server failure
- [ ] Retry is one tap, not "refresh the page"
- [ ] Text remains readable without images loaded
- [ ] The app doesn't poll aggressively on cellular
- [ ] Large uploads resumeable or chunked
- [ ] Service worker caches the shell so return visits are instant

### Red flags

- Blank screen for 6+ seconds on 2G
- "Network error" toast that disappears; no retry, no queue
- Data lost on tab close because it wasn't persisted locally
- Every interaction requires a server round-trip before the UI updates
- App auto-plays hero video over cellular

---

## 4. Screen-reader user Kwame

**Tagline:** Fully blind. NVDA + Chrome. Keyboard-only. Needs semantic HTML.

**Profile:** 40, accessibility consultant, experienced screen-reader user. Runs NVDA on Windows + Chrome. Never uses a mouse. Relies on heading structure, ARIA landmarks, and predictable focus order.

**Journey:** Land on the page → use headings / landmarks to skim structure → tab through interactive elements → complete the same task any sighted user can.

### Walkthrough checklist

- [ ] Page has exactly one `<h1>` and a sensible heading outline
- [ ] Landmarks present: `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`
- [ ] Every interactive element is reachable via Tab in logical order
- [ ] Focus is always visible (`:focus-visible` ring on every control)
- [ ] Buttons are `<button>`; links are `<a>`; no `<div onClick>`
- [ ] Icon-only buttons have `aria-label` or visually-hidden text
- [ ] Form fields have associated `<label>` (not just placeholder)
- [ ] Errors use `aria-invalid` and `aria-describedby` to link the message
- [ ] Modals trap focus, restore on close, and have `aria-labelledby`
- [ ] Live regions (`aria-live`) announce loading / success / error states
- [ ] Dynamic content changes are announced — not silent
- [ ] Images have `alt`; decorative images have `alt=""`
- [ ] Tables have `<th scope>` and captions where relevant
- [ ] Custom components (combobox, tabs, menu) follow WAI-ARIA APG
- [ ] Skip-to-content link exists and works
- [ ] No positive `tabindex` values; no focus traps outside modals
- [ ] Color is not the only signal for error / success / state

### Red flags

- `<div>` with onClick used as a button — not keyboard-reachable
- Custom select built on `<div>` with no ARIA combobox pattern
- Focus ring removed globally (`*:focus { outline: none }`)
- Error toast shown with no `aria-live` — screen reader never hears it
- Modal opens but focus stays on the triggering button

---

## 5. One-thumb Margo

**Tagline:** On the subway. Holding coffee. 30 seconds of attention.

**Profile:** 29, commuter, Mobile Safari, iPhone 14. Holding a coffee in one hand, phone in the other. Checking the app for a quick status glance. If she can't get what she needs in 30 seconds, she closes the tab.

**Journey:** Open link from a notification → get the single answer she came for → maybe take one quick action → leave.

### Walkthrough checklist

- [ ] Primary info is above the fold on a 390px-wide screen
- [ ] Everything she needs to tap sits in the thumb zone (bottom 2/3 of screen)
- [ ] Touch targets ≥ 44×44px
- [ ] No reliance on hover — every affordance works on tap
- [ ] Sticky header/footer doesn't eat 40% of the viewport
- [ ] Safe areas respected (notch, home indicator, keyboard)
- [ ] Forms use correct `inputmode` and `autocomplete` so iOS keyboard cooperates
- [ ] Submit buttons are large and reachable with one thumb
- [ ] Confirmations are visible without scrolling
- [ ] No horizontal scroll unless explicitly intended
- [ ] Back-swipe gesture works; browser back doesn't lose state
- [ ] Modals are dismissible by swipe-down or tap-outside
- [ ] Copy doesn't assume desktop ("click the button on the right")
- [ ] Text is readable without zoom (min 16px body)
- [ ] Sharing respects the system share sheet

### Red flags

- Primary CTA at the top of the viewport — she can't reach it
- Iframe / captcha that doesn't scale to mobile
- Pinch-zoom disabled
- Tooltip-only explanations (no hover on touch)
- Cancel / submit placed 8px apart — fat-finger tapping wrong one

---

## How to Use

Invoked by `/ui-craft:heuristic <target> --persona=<name>`:

| Arg | Persona | Loads |
|-----|---------|-------|
| `--persona=priya` | First-timer Priya | Section 1 |
| `--persona=jordan` | Power user Jordan | Section 2 |
| `--persona=adaeze` | Low-bandwidth Adaeze | Section 3 |
| `--persona=kwame` | Screen-reader user Kwame | Section 4 |
| `--persona=margo` | One-thumb Margo | Section 5 |
| `--persona=all` | All five | All sections |

Output format: same scorecard shape as `heuristics.md` (rows of `| Checklist item | Pass/Fail | Finding | Impact |`). End with top 3-5 findings ranked by impact tag.

Persona walkthroughs do not replace the Nielsen + Design Laws pass — they supplement it. A UI can score well on Nielsen and still fail Kwame.
