# Principles Catalog

A worked-example bank of opinionated design principles, organized by product category. Use as seed material for the principles workshop in `/brief`. Do not adopt these literally — adapt to your specific product, user, and constraints. The point is to see what opinionated, actionable, distinctive principles look like in practice.

---

## How to Read This Catalog

Each principle has four parts: a title (4-7 words), a statement (one line), the design implication it produces (what changes in the product because of it), and an opposing principle it rules out (the contrast that proves it's opinionated).

Categories are starting points, not silos. A finance reconciliation tool may need a "creative tools" principle if its power users have strong workflow preferences. Mix and match across categories — the category label is scaffolding, not a fence.

Strong principles take a stand. If you can flip the principle and the opposite sounds reasonable, the principle is doing work. If the opposite sounds insane, the principle is a platitude — drop it.

Trim to 3-5. More than 5 means none of them are load-bearing. If you have eight, find the two that subsume the others and keep those.

Test against past decisions. Take three real design calls that were debated. Would the candidate principle have resolved them? If it would have flipped a decision you stand behind, it is the wrong principle.

---

## Categories

### 1. Developer Tools (CLIs, dashboards, internal tools)

#### "Show the data, not the design"
**Statement:** chrome retreats; data and state are the entire surface.
**Implication:** color reserved for status (success / warn / error), accent used on the primary action only, typography defaults to monospace for data and humanist sans for chrome. Animations are sub-200ms or absent. Decorative illustrations, hero gradients, and marketing-page polish have no place here.
**Opposite ruled out:** "internal tools deserve the same visual richness as consumer products" — a developer dashboard with gradient headers, large illustrations, and motion choreography signals decoration over function and erodes trust with its audience.

#### "The keyboard is the primary input"
**Statement:** every action is reachable without a pointer.
**Implication:** every modal, panel, and dropdown has a keyboard shortcut. Tab order matches visual order. Command palette covers all global actions. Hover-only affordances do not exist. Mouse-first interactions (drag-to-reorder, right-click context menus without keyboard equivalents) are redesigned or dropped.
**Opposite ruled out:** "power users will learn the UI" — assuming that heavy users will mouse through menus every session trades their time for your engineering convenience.

#### "Error state is a first-class screen"
**Statement:** failure and partial states are designed before the happy path ships.
**Implication:** every async operation has an explicit error state with a recovery action (retry, copy error, open docs). No "Something went wrong" strings without a path forward. Skeleton loaders are paired with error recovery. Empty states are not blank pages.
**Opposite ruled out:** "ship the happy path first, handle errors later" — deferring error states means they ship broken or never; this category's users lose the most time when errors are opaque.

#### "Density by default, space by request"
**Statement:** the default layout is dense; whitespace is earned by user preference.
**Implication:** default row height is compact (32-36px), table padding is minimal, sidebars collapse by default on narrow viewports. A spacious view is available as a user preference, not the default. Every pixel of padding is justified by legibility, not aesthetics.
**Opposite ruled out:** "generous whitespace reads as quality" — in a tool used for hours daily, whitespace that forces scrolling is a cost, not a signal.

#### "State is always visible"
**Statement:** the current view, filter, and scope are always in the viewport.
**Implication:** active filters shown as removable chips above the data, not hidden in a sidebar. Breadcrumbs or scope indicators in the nav. Connection / sync status visible in a persistent corner. "Showing 1-50 of 2,340" is always present on data tables.
**Opposite ruled out:** "minimize chrome to maximize content area" — hiding active state to save pixels means the user constantly re-orients, which costs more than the pixels saved.

#### "Logs beat summaries"
**Statement:** give users the raw output alongside the derived insight.
**Implication:** aggregated metrics always have a "view raw" or drill-down path. Pipeline outputs show the full log, collapsible to summary. No computed status that hides the underlying signal. "3 errors" links to the 3 errors, not a modal that restates the count.
**Opposite ruled out:** "surface insights, not raw data" — for a developer audience, hiding the raw signal behind a summary reads as paternalism and blocks debugging.

---

### 2. Consumer Apps (lifestyle, social, content)

#### "The empty page is the customer"
**Statement:** the user's first action defines the product; the empty state is the most important screen.
**Implication:** loading and empty states receive the same design care as filled states. CTAs in empty states are specific to the likely first task, not generic ("Start your first list" not "Get started"). Templates are visible but never the default — the blank canvas wins by being immediate. Onboarding flows do not gate the empty state.
**Opposite ruled out:** "pre-populate with sample content to show value" — demo data tells the user the product was designed for someone else, not for them.

#### "Speed of the first action"
**Statement:** time from open to first meaningful interaction is the north-star metric.
**Implication:** zero required sign-in gates before the user touches the product. No mandatory tutorial. Profile setup is deferred until after first value. App open → core action is one tap or one keystroke. Onboarding is invisible or async.
**Opposite ruled out:** "complete profile upfront for personalization" — high-friction onboarding before proven value loses users at the first friction point, regardless of the personalization payoff.

#### "Social context compounds value"
**Statement:** every surface becomes more useful when others are present.
**Implication:** sharing affordances are built into the primary action flow, not a separate share sheet. Activity feeds are part of the core loop, not a tab buried in the nav. Reactions, replies, and attributions are near the content, not in a detail view. The single-user experience is the degraded form; the social form is the default.
**Opposite ruled out:** "sharing is a secondary feature" — treating social features as addons rather than core creates a product that is average alone and invisible together.

#### "Personalization shows immediately"
**Statement:** the product adapts visibly to the user from the first session.
**Implication:** recent content, saved preferences, and history are in the primary view on return. No "start fresh" blank slate on every open. The product remembers the last state (scroll position, last viewed item, active draft). First-time experience and return experience are explicitly different designs.
**Opposite ruled out:** "consistent state across sessions ensures predictability" — predictability for its own sake, without personalization, reads as indifferent.

#### "Friction sized to the commitment"
**Statement:** the UI's friction must match what the user is actually committing to.
**Implication:** liking, saving, sharing — zero confirmation. Following someone — one tap, no modal. Deleting an account — modal with explicit consequence. Friction scales with irreversibility and social consequence. No confirmation dialogs on low-stakes actions.
**Opposite ruled out:** "confirm everything to prevent accidental actions" — treating every action as high-stakes makes the product feel bureaucratic and trains users to dismiss confirmations without reading them.

#### "Delight once, then step aside"
**Statement:** expressive moments earn their place at first run; after that, they disappear.
**Implication:** confetti on first completion, celebration animation on first streak — then suppressed on repeat. Onboarding animations do not repeat after session one. Empty states have character for new users; returning-user empty states are functional. The product does not perform joy for users who have moved past the new-user phase.
**Opposite ruled out:** "consistent animation keeps the product feeling alive" — animations that were delightful at first run become noise by week two. Respecting the user's familiarity is its own form of polish.

---

### 3. Finance / Regulated (compliance-first, audit trails)

#### "Wrong is worse than late"
**Statement:** confirm everything; recovering from a mistake is more expensive than friction.
**Implication:** confirmation modals on every irreversible action, no fast-paths around them, detailed receipts after every transaction. Undo windows exist where the underlying API allows; where they do not, the action is labeled explicitly. Loading states linger over feedback states — the user needs to know the server confirmed before proceeding.
**Opposite ruled out:** "delight via speed" — instant-feeling interactions in finance contexts read as careless. Speed at the cost of confirmation is a liability, not a feature.

#### "Everything has an author and a timestamp"
**Statement:** every state change is attributed and dated.
**Implication:** audit logs are a first-class surface, not a compliance afterthought. Inline attribution ("Last edited by J. Reyes, Mar 4 14:22") is visible without drilling into a log. Deletions are soft-deletions with a visible record. No anonymous mutations in shared records.
**Opposite ruled out:** "users don't want to see attribution clutter" — regulated contexts require it, and even where they don't, attribution is the primary trust signal between collaborators handling money.

#### "The number is the hero"
**Statement:** the key figure dominates every surface that contains it.
**Implication:** primary amounts are the largest element on the card or row. Supporting context (date, category, status) is secondary — smaller, lower-weight, lower-saturation. No icon grids, feature lists, or decorative elements share visual weight with a financial figure. The hierarchy is always number first.
**Opposite ruled out:** "balanced information hierarchy for readability" — in finance, burying the primary number in a visually balanced layout slows the task and erodes trust.

#### "Export is a primary action"
**Statement:** data that cannot leave the product is a liability in regulated contexts.
**Implication:** CSV, PDF, and audit-format exports are accessible from every data surface without navigating away. Export is in the primary toolbar, not buried in a settings menu. Export respects the current filter and scope. Scheduled export is a feature, not a power-user workaround.
**Opposite ruled out:** "minimize exports to keep users in the product" — in compliance and finance contexts, data portability is a trust signal. Restricting it reads as controlling, not sticky.

#### "Status is never ambiguous"
**Statement:** every record has an explicit, visible state — pending, confirmed, failed, reconciled.
**Implication:** status badges are always present and high-contrast, never inferred from context. Pending and processing states are distinct (not both "loading"). Failed states have a reason, not just a label. Filtering by status is a first-class affordance, not a power-user feature.
**Opposite ruled out:** "reduce visual noise by hiding status for healthy records" — hiding status until something goes wrong means users only interact with the system in crisis mode, which erodes confidence.

---

### 4. Creative Tools (design, writing, video)

#### "The canvas is sacred"
**Statement:** chrome serves the canvas; the canvas never serves chrome.
**Implication:** every panel, toolbar, and overlay is dismissable, collapsible, or fades on inactivity. The active workspace gets the largest available area. Tool palettes can be repositioned. Keyboard shortcuts cover every chrome action. The canvas area does not shrink for notification banners, update prompts, or upsell overlays.
**Opposite ruled out:** "discoverable UI via persistent surfaces" — keeping toolbars permanently visible signals distrust of the user's ability to learn. It also treats every pixel of chrome as more valuable than the user's work.

#### "Undo is unlimited"
**Statement:** the user is never punished for experimenting.
**Implication:** undo history is per-session and deep (50+ steps). Destructive actions have a visible undo window, not just a warning. Version history is a first-class feature, not a recovery tool of last resort. The product does not ask "are you sure?" — it asks "do you want to undo?" after the fact.
**Opposite ruled out:** "confirmation before destructive actions prevents mistakes" — pre-action friction slows creative work. Post-action undo restores the same safety with none of the interruption.

#### "Presets are a starting point, not a destination"
**Statement:** every preset is editable; no workflow ends at a template.
**Implication:** templates and presets always resolve to the underlying editable state, not a locked copy. "Customize" is always available after applying a preset. The preset library is visible and searchable, but the blank-canvas affordance is equal or greater in visual weight. Users who start from a preset should not feel their work is "derivative."
**Opposite ruled out:** "guide users through templates for better outcomes" — prescriptive guidance in a creative tool signals that the product does not trust the user's judgment.

#### "History is visible, not just recoverable"
**Statement:** the user can see what changed, not just revert to before it changed.
**Implication:** version history shows a diff or thumbnail, not just a timestamp. Side-by-side comparison of two versions is possible. Change annotations ("changed from 24px to 18px") are in the undo stack, not just in abstract state. Power users can branch from any point in history.
**Opposite ruled out:** "save storage by keeping only the last N versions" — capped history limits creative risk-taking; users self-censor experiments when they know they cannot reach back far enough.

#### "Collaboration is opt-in, not default"
**Statement:** the single-user experience is complete; sharing is additive.
**Implication:** the product loads immediately without a sign-in gate. Collaboration features (comments, live cursors, sharing) are available when the user is ready for them, not surfaced on first open. A solo creator who never shares their work has the same tier of product quality as a team user.
**Opposite ruled out:** "build for collaboration first; solo use is a subset" — treating solo use as a downgrade punishes independent creators and makes the product feel socially coercive.

---

### 5. Data Analytics (BI, dashboards, monitoring)

#### "One number per screen"
**Statement:** every dashboard surface has a hero metric; everything else supports it.
**Implication:** the primary metric is largest, has the most contrast, sits in the optical center of the above-the-fold zone. Supporting metrics are explicitly subordinate (smaller, lower-weight, lower-saturation). No grid of equal-weight cards — hierarchy is visible at a glance from across the room.
**Opposite ruled out:** "let users decide what's important" — the absence of hierarchy is itself a design choice, and it always reads as the team did not decide. Equal-weight grids push every judgment onto the user and slow time-to-insight.

#### "Comparison is the unit of understanding"
**Statement:** a number without context is noise; every metric shows its comparison.
**Implication:** primary metrics always show period-over-period change (vs. prior week, vs. target). Sparklines on every metric card. Trend direction is signaled by color and icon, not just a number. Tables have inline comparison columns. No standalone counts without a denominator or a delta.
**Opposite ruled out:** "show current state; let users query for comparison" — requiring users to manually request comparison on every visit is an analysis tax. Comparison belongs in the default view.

#### "Drill-down is always one click"
**Statement:** every aggregated view resolves to its component data in one action.
**Implication:** clicking a chart segment opens the underlying records. Clicking a metric opens the contributing events. Breadcrumbs track the drill path. Back navigation returns to the aggregated view with state preserved. No aggregated view is a dead end.
**Opposite ruled out:** "keep the dashboard clean by removing drill-through affordances" — a dashboard that cannot answer "why" is an alert surface, not an analytics surface.

#### "Filters are first-class state"
**Statement:** the active filter configuration is a shareable, bookmarkable artifact.
**Implication:** filter state lives in the URL. Active filters are visible as removable chips above the data. "Share this view" produces a link that preserves filter state. Default filters are explicit, not implicit. Saving a filter configuration is a primary action, not a power-user feature.
**Opposite ruled out:** "filters are a temporary interaction, not state" — ephemeral filters mean users recreate the same analysis on every visit and cannot share findings with colleagues.

#### "Anomalies surface themselves"
**Statement:** the user should not have to look for outliers; the surface finds them.
**Implication:** statistical outliers are visually distinct (different color, flagged row, annotated data point) without requiring the user to configure a threshold. Alert states are visible in the default view. The absence of anomalies is also communicated explicitly ("all metrics within normal range"). Silence is a state, not the default.
**Opposite ruled out:** "show all data equally; users will spot patterns" — presenting uniform data without anomaly detection turns the analyst into a manual filter, adding no value over raw exports.

---

### 6. Collaborative Tools (real-time, multi-user)

#### "Presence is content"
**Statement:** who is on the surface matters as much as what is on the surface.
**Implication:** active users are always visible (avatars in nav, cursors in canvas, edits attributed inline). Conflict states are first-class designs, not hidden errors. Optimistic updates with reconciliation are the default; loading states are exceptional. The product communicates "you are not alone here" at every moment.
**Opposite ruled out:** "single-user UX with multiplayer features added later" — when single-user is the assumed base, collaboration feels grafted on. Presence needs to be architectural, not a feature flag.

#### "Conflict is expected, not exceptional"
**Statement:** simultaneous edits are the happy path; sequential editing is the edge case.
**Implication:** merge conflict UI is fully designed before launch, not handled by a generic error. Conflict resolution has a clear owner (last-write-wins, or explicit picker, or merge view) and it is documented in the product. The user is never dropped into an undefined state because two people edited the same field.
**Opposite ruled out:** "prevent conflicts via locking" — locking blocks work. Collaborative products that serialize writes to prevent conflicts have misunderstood their category.

#### "Attribution is visible, not interrogated"
**Statement:** the origin of every change is visible without opening a history panel.
**Implication:** inline attribution ("J. Reyes" next to an edited cell, an avatar on a comment) is standard in the default view. History is for audit, not for understanding current state. New content from other users is visually differentiated until dismissed. "Who did this?" has an answer in the main view.
**Opposite ruled out:** "attribution belongs in activity logs, not the main surface" — burying authorship in a panel means users lose context about what is new and what is theirs, slowing trust-building in shared workspaces.

#### "Async and sync are the same surface"
**Statement:** the product works for people in different timezones using the same interface.
**Implication:** unread changes are surfaced at the top of the affected view on return, not in a notification inbox. Comments thread in context, not in a sidebar. Status indicators (online now / last seen) are present but not the primary affordance. A user returning after 8 hours sees the same product as a user who was online during those 8 hours.
**Opposite ruled out:** "optimize for real-time; async users use notifications" — bifurcating async users into a notifications inbox creates a two-tier experience and signals the product was designed for a single timezone team.

#### "Undo survives other users"
**Statement:** a user can revert their own changes even after others have built on top of them.
**Implication:** per-user undo history is maintained separately from the shared document state. Reverting a change produces a new change, not a silent overwrite. The user is informed when their undo would affect content another user has seen or built on. Undo is never blocked because someone else has since edited the same record.
**Opposite ruled out:** "shared document state supersedes individual undo" — stripping undo after a collaborator touches a record makes users afraid to experiment in shared spaces.

---

### 7. AI / Streaming Surfaces

#### "Streaming is a state, not a transition"
**Statement:** mid-stream is a first-class UI state with its own affordances.
**Implication:** designed token-by-token streaming with a visible caret, partial citations rendered as they arrive, a mid-response abort affordance always present. Stream-complete is its own distinct state with a summary, feedback controls, and copy/share affordances. No skeleton loaders during streaming — they communicate "wait" when the system is communicating "I am thinking."
**Opposite ruled out:** "show a spinner until the full response arrives" — collapsing the streaming experience into a loading state discards the primary trust signal (visible progress) and makes the product feel slower than it is.

#### "Tool use is observable"
**Statement:** when the model calls a tool or searches a source, the user sees it.
**Implication:** tool calls are rendered as trace items inline with the response, not hidden behind the output. Web searches, code executions, and API calls show the query and result summary, not just the derived answer. Power users can expand traces to full detail. The product never presents a derived answer without attributing the source.
**Opposite ruled out:** "hide tool calls to keep the experience clean" — hiding the reasoning behind AI outputs reduces trust and prevents the user from catching errors in the sourcing step.

#### "Regeneration is always available"
**Statement:** every AI response has a retry path that the user can reach without retyping.
**Implication:** regenerate is a persistent affordance on every response, not just the most recent one. Editing a prompt to regenerate is one click, not a delete-and-retype flow. Variant generation (same prompt, different result) is available. The user is never trapped with a single output.
**Opposite ruled out:** "one response per prompt keeps the interaction clean" — without regeneration, the user loses trust in the system when the first output is wrong, because they perceive no recourse.

#### "Citations are load-bearing, not decorative"
**Statement:** every factual claim has a traceable source; citations are interactive, not footnotes.
**Implication:** cited sources are inline, hoverable or clickable, and open the source in context. Citations appear during streaming, not only after completion. The UI distinguishes between high-confidence and low-confidence citations (e.g., direct quote vs. paraphrase). A response with no citable sources is visually distinct from one with citations.
**Opposite ruled out:** "citations clutter the reading experience" — removing citations to improve readability trades user trust for surface aesthetics. In AI surfaces, the citation is the proof, not the decoration.

#### "Feedback closes the loop"
**Statement:** the user can signal quality, and the signal is visible as confirmed.
**Implication:** thumbs up/down or equivalent is always present on completed responses. Submitting feedback produces visible confirmation (not a silent network request). Negative feedback opens a specific follow-up (what was wrong?), not a generic rating. Feedback state persists on the response after page reload.
**Opposite ruled out:** "feedback is a product-side signal; users don't need to see it confirmed" — invisible feedback signals read as dismissed. Confirmation closes the trust loop and increases feedback volume.

---

### 8. Public-facing Forms (sign-up, checkout, applications)

#### "Friction sized to commitment"
**Statement:** the form's resistance must match what the user is actually agreeing to.
**Implication:** account creation requires email only (no profile, no avatar, no phone on the first step). Checkout uses smart defaults — saved address, autofill, no required account creation. Application forms show progress and allow resume-anywhere. Friction increases only where the commitment justifies it (2FA on first payment, ID verification on regulated actions).
**Opposite ruled out:** "collect all necessary information upfront to avoid re-engagement" — high-friction sign-ups for unproven value lose users at the first required field. Collecting data early optimizes for the product's convenience, not the user's.

#### "Validation never surprises"
**Statement:** errors appear where the user is, not where they are going.
**Implication:** inline validation fires on blur, not on submit. Error messages name the field and state the fix, not the rule violated ("Enter a valid email address" not "Invalid format"). Password rules are visible before the user types, not after they fail. Submit-time errors scroll to the first error; the user does not have to find it.
**Opposite ruled out:** "validate on submit to avoid interrupting the flow" — submit-time validation collapses all errors into one moment of failure, maximizing frustration and minimizing the information density needed to fix each error.

#### "Progress is always visible"
**Statement:** the user knows where they are, how far is left, and what they have completed.
**Implication:** multi-step forms show a step indicator that counts completed and remaining steps. Step labels are specific ("Payment details" not "Step 3"). Completed steps are accessible for review without losing current state. The last step is labeled "Submit" or equivalent — never "Next."
**Opposite ruled out:** "hide progress to avoid anchoring users to effort" — hiding progress trades completion anxiety (I don't know how long this will take) for commitment bias (I've come this far). Most users benefit from knowing the end is near.

#### "Defaults are decisions"
**Statement:** every pre-filled value or pre-selected option was chosen deliberately, not as a placeholder.
**Implication:** pre-selected checkboxes are opted-in by default only when the user would genuinely expect them (save address for future orders — reasonable; opt into marketing email — not reasonable). Auto-selected tiers or plans are the one that matches the most common user, not the most profitable. Pre-filled dates use the most likely answer. No field has a default that benefits the product at the user's expense.
**Opposite ruled out:** "use defaults that maximize conversion or revenue" — dark-pattern defaults are a one-time conversion gain traded for long-term trust erosion and churn.

#### "Submit is one button"
**Statement:** the primary action is always singular and unambiguous.
**Implication:** no forms have two competing primary actions at the bottom ("Save" + "Submit" at equal weight). Secondary actions (save draft, cancel) are visually subordinate. The primary button label says what happens after the click ("Create account", "Place order", "Send application"). No CTAs labeled "Continue," "Next," or "Finish" on the final step.
**Opposite ruled out:** "multiple actions give users flexibility" — equal-weight competing actions on a form are the fastest path to the wrong action. Flexibility in form submission is a failure of design confidence.

---

## Anti-principles (what NOT to write down as a principle)

These are platitudes that masquerade as principles. They look opinionated but rule nothing out. If your candidate principle appears on this list, rephrase it or discard it.

- **"Be user-friendly"** — opposite ("be user-hostile") is insane. Not opinionated. Every product claims this.
- **"Design with empathy"** — opposite ("design without empathy") is incoherent. Too vague to produce a design implication.
- **"Make it beautiful"** — beautiful is undefined and context-dependent. No design decision follows from it.
- **"Mobile-first"** — this is consensus in 2026, not a stance. It belongs in your stack defaults, not your principles.
- **"Accessibility matters"** — yes. This is the floor, not a principle. Every surface must be accessible; treating it as a principle lets non-accessible surfaces exist by default.
- **"Keep it simple"** — "simple" is undefined. This is a preference, not a constraint. "Show the data, not the design" is what "keep it simple" actually means for a developer tool.
- **"Modern design"** — modern compared to what, when? This is an aesthetic preference with no design resolution power.
- **"We care about our users"** — a mission statement, not a principle. Put it in the README, not the brief.

A principle that produces no design implication and rules out no alternative is a slogan. Slogans go in marketing copy, not in `.ui-craft/brief.md`.

---

## When to Skip Categories

The catalog covers archetypes. Many products span multiple categories and should borrow from each.

A developer tool with a consumer-facing onboarding flow needs Developer Tools principles for the product surfaces and Consumer Apps principles for the sign-up and first-run experience. Write the brief in two scoped sections rather than forcing all principles to cover both.

Internal tools where the design language is intentionally platform-native (system UI, operating-system controls) can adopt the platform's implicit principles rather than inventing product-specific ones. Codify only the places where the product diverges from platform defaults — those are the only decisions that need an explicit principle.

Pre-launch products may lack enough product reality to write distinctive principles. The "would anyone disagree?" test from `brief.md` is the gate: if every candidate principle passes it trivially (the opposite sounds insane), defer the principles workshop until you have user reality to anchor against. Provisional principles based on hypotheses are acceptable — mark them as provisional and revisit after first usability sessions.

Products built on a design system (shadcn, MUI, platform-native) inherit a set of implicit principles from that system. Those inherited principles do not need to be restated. Write only the principles where this product diverges from or extends the system's defaults.

---

## Cross-References

- `brief.md` — the parent reference; this catalog is invoked from the principles workshop section. The brief format that consumes these principles is defined there.
- The `inspiration.md` "what mature interfaces never do" section is the empirical complement to this catalog. Those are observed patterns from production products; these are intentional commitments. Both are needed: observation shows what the standard is; principles show where you differ from it.
