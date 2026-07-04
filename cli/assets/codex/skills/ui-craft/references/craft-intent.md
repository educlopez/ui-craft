# Craft Intent — Read, Variance, Signature

Load on every `/craft`, default Build mode, and when the user asks for a full surface without naming a command. This file is the **generative front door** — declare intent before writing code.

---

## 1. Craft Read (mandatory before code)

Before tokens or layout, output **one line** the user can react to:

> **Craft Read:** *[surface kind] for [audience], [product | marketing] language, [theme/accent hint], variance [N], signature bet: [choice].*

**Infer from:** page/app kind, vibe words ("minimal", "editorial", "dense", "playful"), references the user named, existing brand tokens, audience.

**Examples:**

- *Craft Read: B2B ops dashboard for finance admins, product language, Graphite + teal accent, variance 4, signature bet: hero metric card with sparkline.*
- *Craft Read: devtool launch page for technical buyers, marketing language, Porcelain + indigo, variance 7, signature bet: product screenshot cropped at fold with floating proof card.*
- *Craft Read: designer portfolio for hiring managers, marketing language, editorial type, variance 8, signature bet: kinetic display headline with italic emphasis in same family.*

If the brief is ambiguous, ask **one** clarifying question — never a questionnaire. If inferable, declare the Craft Read and proceed.

**Anti-default discipline:** Do not reach for purple mesh gradients, centered symmetric heroes with three equal icon cards, full-black sidebars, or Inter-on-everything without an articulated reason.

---

## 2. DESIGN_VARIANCE knob (1–10)

Separate from **VISUAL_DENSITY** (how much fits) and **CRAFT_LEVEL** (how refined). Variance controls **layout risk and creative amplitude**.

| Variance | Product surfaces | Marketing surfaces |
|----------|------------------|-------------------|
| **1–3** | Symmetric grids, safe hierarchy | Centered hero OK only with asymmetric support |
| **4–6** | Split layouts, metric hierarchy, one layout break | Split/bento heroes, alternating feature rows |
| **7–8** | Strong typographic moments in shell (empty state, onboarding) | Asymmetric offsets, scroll-linked logo strip, display scale drama |
| **9–10** | Rare — one experimental shell moment only | Kinetic type, scroll choreography — **explicit brief or user asks "experimental"** |

**Defaults when user doesn't specify:**

| Surface | Default variance |
|---------|------------------|
| Dashboard, settings, auth, tables | **4** |
| Landing (live product) | **7** |
| Landing (waitlist / pre-launch) | **6** |
| Portfolio, case-study, launch event | **8** |

`/bolder` raises variance (+1–2, cap 10) and motion (+1, cap 10). `/quieter` lowers both. Honor `prefers-reduced-motion` always.

---

## 3. Signature bet (mandatory — not polish-gated)

Every `/craft` ships **exactly one** memorable decision, chosen at plan time and built in Step 3 — not deferred to `/polish`.

### Product surfaces (pick one)

1. Custom empty-state motif (simple SVG tied to domain)
2. Distinctive nav active indicator (left bar, pill, or dot) — system-wide
3. Welcome / first-run panel — dismissible, value-focused
4. Primary table row hover (subtle lift + shadow on the main table only)
5. Command palette or keyboard hint (`⌘K`) when search/actions warrant it

### Marketing surfaces (pick one)

1. Hero crop — product visual cut mid-element at fold edge
2. Floating proof card over screenshot (metric, notification)
3. Custom section marker (FIG label, domain icon motif)
4. Distinctive CTA copy — specific verb, not "Get started"
5. One scroll moment — logo strip or restrained headline entrance (variance ≥7)

Name the bet in the Craft Read. Build it in the first pass.

---

## 4. Product surface patterns (apps, dashboards, settings)

Apply on dashboard, auth, settings, onboarding, admin — load with [recipe-dashboard.md](recipe-dashboard.md).

**Shell:** Tinted sidebar (not full black). Active nav = accent/10 + accent text. Page header row: title + context + primary action aligned.

**Data:** One hero metric (larger, accent tint); secondaries neutral. Sparklines in KPI cards where trends matter. Table rows with context (avatar, status dot, proportion bar) — not plain grids. Ghost buttons in filter toolbars; primary CTA lives outside the toolbar.

**Type & color:** `tabular-nums` on numbers. Sentence case on nav and headers. Tinted surfaces (`accent/5` on primary card). Semantic green/red only when the domain expects it.

**Motion:** Optimistic UI where saves matter. Skeletons match final layout. `:active` micro-push (`scale(0.98)`). One staggered entrance per section max, `once: true`.

**States:** Empty states with icon + one sentence + CTA. Errors with retry/copy path. Onboarding checklists 3–5 steps, dismissible.

**Avoid in product shells:** scroll pinning, kinetic body copy, mesh backgrounds behind tables, glass on dense forms, decorative carousels.

---

## 5. Marketing surface patterns (landings, portfolios)

Apply on landing, portfolio, waitlist — load with [recipe-landing.md](recipe-landing.md) and [inspiration.md](inspiration.md) hero archetypes.

**Composition:** Pick one hero archetype (product-forward, message-forward, proof-forward, bento, editorial figure, social proof strip). **No two adjacent sections share the same layout.**

**Type:** Display 48–80px H1, tight tracking, sentence case. Font pairing from theme preset or brief — body + optional display. Emphasize with italic/bold **same family**, not random serif injection.

**Color:** 90% neutral + one accent; rotate accent family when no brand (indigo, teal, rose, amber, forest). No default warm-beige + brass "premium" palette unless the brief names it.

**Motion:** Hero stagger 50–80ms; one scroll reveal per section; multi-property hover on **one** featured block. No bounce, confetti, or idle float.

**Portfolio:** Variable grid aspects; one hero project above fold; asymmetric about/contact — not centered template.

---

## 6. Rotation (when no brand direction)

Rotate **one axis per build** so outputs don't converge:

| Axis | Pool (pick 1) |
|------|----------------|
| Theme preset | Graphite, Porcelain, Signal, Carbon — [themes.md](themes.md) |
| Accent family | indigo, teal, rose, amber, forest (OKLCH-safe) |
| Signature bet | from §3 lists |

Declare the axis in the Craft Read so the user can say "warmer accent" on iteration.

---

## Cross-refs

[recipe-dashboard.md](recipe-dashboard.md) · [recipe-landing.md](recipe-landing.md) · [inspiration.md](inspiration.md) · [themes.md](themes.md) · [dashboard.md](dashboard.md) · [review.md](review.md)
