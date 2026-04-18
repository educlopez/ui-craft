# State Design — Design the Unhappy Path First

Every interactive surface has more states than "it works." The happy path is the easy one. Idle, loading, empty, error, partial, conflict, and offline are where real UX lives — and where AI-generated UIs fall apart.

Design every state before writing any JSX. Stub the ones the knob level doesn't require — don't skip them.

---

## The State Lattice

Every component-that-touches-data has this set. For each, design the visual AND the copy before coding.

| State | What to design | Common mistake |
|-------|---------------|----------------|
| **Idle** | Default resting state. Primary action obvious. | Treating "empty form" as idle — it's actually Empty. |
| **Loading** | Skeleton matching final layout. Appears after 200ms. | Centered spinner on a blank screen (no layout match, no cue). |
| **Empty** | Explain why empty + CTA to fix it. | "No data" with no illustration, no explanation, no next step. |
| **Error** | Specific cause + one-click recovery + support ID. | "Something went wrong" with no detail and no retry. |
| **Partial** | Some data loaded, some failing. Show what succeeded. | Hide everything because one field failed — user sees blank. |
| **Success** | Positive feedback, brief, visual + textual. | Toast that vanishes in 1s; user misses it. |
| **Conflict** | Two actors edited. Show both, let user resolve. | Last write wins silently; prior user's work is gone. |
| **Offline** | Connection lost. Queue writes. Communicate. | Pretend everything is fine; fail on next sync. |

---

## Design the Unhappy Path First

Designing loading / empty / error states first produces a better happy path. When you start from "the list is empty and we need to onboard the user," the happy-path card has a job it has to fit into, not the other way around. When you start from "this API returns an error," your loading skeleton and retry copy are baked in, not bolted on.

Teams that design happy-first ship demos that crumble on real data. Teams that design unhappy-first ship products.

---

## Loading States

**Skeleton rules:**
- Match the final layout — same grid, same rough box sizes. Skeletons that don't match cause cumulative layout shift (CLS) when real content arrives.
- Show after **200ms**, not immediately. A flash of skeleton for fast responses looks broken.
- Set an upper bound of **5s**. Past that, escalate to a progress indicator or a timeout message with a retry.
- Use a subtle pulse or shimmer — not a spinner on top of a skeleton. One signal is enough.
- Preserve stable layout for known elements (avatar, title) while skeletonizing variable ones (body, list).

**Button loading:**
- Keep the label; don't swap to just a spinner. Users lose context.
- Disable but don't hide — users click it trying to cancel.
- Spinner goes *inside* the button, not next to it.

**Navigation loading:**
- Optimistic route change — paint the new layout immediately; stream data into it.
- A progress bar at the top of the viewport is better than a blank screen.

---

## Empty States

Empty states are the most skipped state and the most valuable. A first-time user sees an empty state before any happy path.

**Required:**
- Explain **why** it's empty — "You haven't created any projects yet" beats "No data"
- Offer **a next action** — a CTA to populate the state. Every empty state is a call to onboard.
- Visual or illustration — even a subtle icon. Prevents the "this page is broken" read.
- Secondary info if useful — "Projects help you organize your work. Learn more."

**Empty state types:**
- **First-run empty** (user just signed up) — onboarding. Heavy CTA.
- **Filtered empty** (user applied filters that match nothing) — "No results — try removing filters" with a clear-filters button.
- **Cleared empty** (user archived / deleted everything) — celebratory or contextual; may not need a CTA.

---

## Error States

Specific beats generic. Actionable beats dead-end. Recoverable beats fatal.

**Field-level errors:**
- Inline, at the field. Not a toast, not a global banner.
- Describe the problem AND the fix — "Password must include a number" beats "Invalid password."
- Red is a signal, not the whole message. Pair color with icon and text.
- `aria-invalid` + `aria-describedby` so screen readers announce.

**Form-level errors:**
- Scroll to the first invalid field, focus it.
- Summary at the top is fine in addition to inline, not instead of.

**Server errors:**
- Specific cause if you know it ("File too large — max 10MB").
- Copy-paste support ID — `Error ID: xyz-123` — so the user can send it to support.
- One-click retry where possible.
- Never blame the user for network failures.

**Network errors:**
- Distinguish offline from 500 from 403. Different causes, different fixes.
- Keep the in-flight state — don't throw away the form the user just filled.

---

## Conflict, Partial, and Offline States

These are the forgotten states. Designing them separates products from demos.

### Conflict

Two users edited the same resource at the same time. Someone's about to lose work if you don't handle this.

- Detect via version / etag / updated_at.
- Present both versions. Let the user pick or merge.
- Never silently overwrite. The "last write wins" pattern looks like a bug to the losing user.
- For high-frequency collaborative surfaces, consider CRDT or operational transform rather than explicit conflict UI.

### Partial

Some data loaded, some failed. Common with multi-source dashboards or parallel fetches.

- Show what succeeded.
- Mark what failed with a per-tile error state, not a page-level one.
- Let the user retry the failing piece without reloading the rest.
- Example: dashboard with 6 metrics, one metric API is down — render 5 metrics + one inline error tile with retry.

### Offline

Connection is gone. Anticipate this on mobile, field apps, travel, and flaky wifi.

- Detect with `navigator.onLine` + a heartbeat (more reliable).
- Communicate at the app shell: "You're offline — changes will sync when reconnected."
- Queue writes locally (IndexedDB, localStorage). Optimistic UI locally.
- Reconcile on reconnect: apply queued writes, handle conflicts, surface any rejections.
- Disable actions that *require* connectivity (payments) — explain why.

---

## State Machine Reference

Don't ship a state library for this. But think in state machines. Pseudocode:

```
states:
  idle          -> on FETCH -> loading
  loading       -> on SUCCESS(data=empty)   -> empty
                 -> on SUCCESS(data)         -> success
                 -> on SUCCESS(data=partial) -> partial
                 -> on ERROR(network)        -> offline
                 -> on ERROR(server)         -> error
                 -> on TIMEOUT               -> error
  empty         -> on CREATE  -> loading
  error         -> on RETRY   -> loading
  partial       -> on RETRY   -> loading (retains successful data)
  offline       -> on ONLINE  -> loading (retries + drains queue)
  success       -> on EDIT    -> loading (optimistic)
                 -> on CONFLICT -> conflict
  conflict      -> on RESOLVE -> loading
```

The mental model is the value. Use `useReducer`, XState, Zustand slices, or plain discriminated unions — whatever the project uses. Just don't model states as disconnected booleans (`isLoading && !error && !data`) — that's how impossible states appear.

---

## Checklist

Before any interactive surface ships, every item on this list is designed (not necessarily implemented — design can be "stubbed as an empty component"):

- [ ] Idle state has a clear primary action
- [ ] Loading state matches final layout; appears after 200ms
- [ ] Empty state has explanation + CTA + visual
- [ ] Error state is specific, actionable, and recoverable
- [ ] Partial state handled if data has multiple sources
- [ ] Success state provides visual feedback (not color-only)
- [ ] Conflict state exists if the resource is collaborative
- [ ] Offline state exists if the user-journey is likely on mobile / flaky networks

**Knob gating (used by `/ui-craft:unhappy`):**

| CRAFT_LEVEL | Required states |
|-------------|----------------|
| ≤ 4 | idle, loading, error |
| 5-7 | idle, loading, empty, error, success |
| 8+ | all of the above plus partial, conflict, offline |

Missing a required state is a finding. Fix before declaring the happy path "done."
