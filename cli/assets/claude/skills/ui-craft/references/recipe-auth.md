# Recipe: Auth (Sign in / Sign up)

Outcome recipe for authentication surfaces. Small surface, zero tolerance: auth is used by 100% of users at their least patient moment, and it's where AI-generated UIs are most recognizable (full-bleed saturated brand panel, italic quote, "OR" divider). Field rules live in [forms.md](forms.md), component contracts in [components.md](components.md).

## Step 0 — Two inputs (defaults if unanswered)

| Input | Options | Default |
|---|---|---|
| Brand surface | product has marketing presence worth showing / pure utility app | marketing presence |
| Auth methods | SSO-first (Google/GitHub/SAML) / email-first / both | both, SSO on top |

## Step 1 — Pick the composition

### Split panel (default — brand presence)

```
┌──────────────────────────┬────────────────────┐
│ logo                     │                    │
│                          │  Welcome back      │
│  ONE proof asset:        │  sub, one line     │
│  metric + sparkline      │  [SSO] [SSO]       │
│  OR attributed quote     │  ── or with email ─│
│  (pick one, not a deck)  │  Email             │
│                          │  Password  Forgot? │
│                          │  [Sign in]         │
│ trust footer (compliance)│  New here? link    │
└──────────────────────────┴────────────────────┘
```

Panel is a **tinted neutral surface** (gray-1 of the theme), NEVER a full-saturation brand flood — a wall of pure accent is the single loudest AI tell on auth screens, and it blows the entire accent budget on decoration. Panel content: one believable proof asset with real numbers or a real attribution. Trust line at the panel's foot (compliance, data residency) — sign-in is where users think about trust.

### Centered card (utility / in-product re-auth)

```
┌───────────────────────────────────────────────┐
│                                               │
│              logo (small, centered)           │
│              Welcome back                     │
│              [SSO buttons]                    │
│              ── or with email ──              │
│              form card, 360-400px             │
│              footer links                     │
│                                               │
└───────────────────────────────────────────────┘
```

No panel, no story — speed is the design. Card 360-400px, generous vertical rhythm, page background gray-1 with the card on white (or theme surfaces in dark).

## Step 2 — Form contract (non-negotiable)

- Form column **360-400px**. Wider reads as a document; narrower cramps the SSO row.
- **SSO buttons above email** when SSO is the dominant path — order by actual usage, not aesthetics. Equal visual weight between SSO providers (neutral outline buttons, real provider marks).
- Divider is lowercase, quiet: "or with email" — not "OR" shouting in caps.
- Labels above fields ([forms.md](forms.md)); "Forgot password?" inline with the password label, right-aligned — not buried under the button.
- **No required asterisks** — every field on an auth form is required; single-purpose familiar forms skip marking entirely ([forms.md](forms.md)).
- Password: show/hide toggle with `aria-label`. On sign-UP: live strength hint, validate-as-you-type with debounce; never a wall of "must contain" rules before the user types.
- Submit: full-width primary, verb label ("Sign in", "Create account") — the page's ONE accent-filled element. Stays enabled; validates on press ([forms.md](forms.md)).
- Error state: message below the offending field + border, focus moved to it. Auth errors stay honest but unspecific where security demands ("Email or password doesn't match") — and actionable where it doesn't (rate-limit: say when to retry).
- Cross-link the sibling flow ("New here? Start a free trial") — one line, after the submit.

## Step 3 — Sign-up deltas

- Ask the minimum: email + password (+ name only if the product needs it day one). Every extra field measurably increases drop-off — enrich the profile later, in-product.
- State what happens next under the CTA ("We'll send a verification link").
- Legal line (terms/privacy) in tertiary text under the CTA — present, quiet, real links.
- Multi-step signup (workspace, invites): apply the multi-step contract from [forms.md](forms.md) — cost upfront, easy→hard, progress.

## Acceptance bar

- [ ] Squint test: eye lands on the submit button; accent appears ONLY on submit + links
- [ ] No saturated full-bleed brand panel; panel (if any) is tinted neutral with one proof asset
- [ ] Form column 360-400px, labels above, no asterisks, divider lowercase
- [ ] "Forgot password?" findable without scanning; sibling flow cross-linked
- [ ] Submit enabled + validates on press; errors below fields, focus managed
- [ ] Keyboard: tab order top-to-bottom, Enter submits, focus visible on every control
- [ ] Trust signals present (compliance line or equivalent) and honest
- [ ] Works at 320px wide: panel drops, form survives alone

## Cross-refs

[forms.md](forms.md) field layout, validation, marking · [components.md](components.md) buttons, links · [themes.md](themes.md) surface tokens · [state-design.md](state-design.md) loading/error states for the submit roundtrip
