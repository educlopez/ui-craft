# Product positioning — dual objectives

> **Updated (maintainer, 2026-07-04):** Two parallel goals — not either/or.

---

## Objective A — Production apps (primary audience)

Help **thousands of users without design knowledge** ship **production UI** that looks and feels professionally designed:

- Dashboards, settings, auth, tables, forms, onboarding, empty states
- Demo-ready on first `/craft` — no design vocabulary required
- Technical rigor stays (gates, states, a11y, density)

**Win:** *"Did you hire a designer?"* on a CRUD admin panel.

→ Patterns: [production-trends.md](./production-trends.md)

---

## Objective B — Marketing surfaces (creative ambition)

**Also** improve landings, portfolios, and brand-facing pages with real creative range — composition, typography drama, motion, trend-aware layouts. We never focused here strongly; competitors (Taste) win hearts on these surfaces. That gap is real and worth closing.

- Landing pages, portfolios, launch pages, waitlists, case-study sites
- Higher **DESIGN_VARIANCE** authorized when surface = marketing
- Learn from Taste: Design Read, palette rotation, asymmetric heroes, kinetic type — without becoming a landing-only skill

**Win:** *"I'd put this on my site / send this to investors."*

→ Patterns: [marketing-trends.md](./marketing-trends.md)

---

## Shared creative layer (both tracks)

Both objectives share the same failure mode today: **we correct slop before we declare intent.** Fix once, apply everywhere:

| Primitive | Production (A) | Marketing (B) |
|-----------|----------------|-----------------|
| **Craft Read** | Product thesis — "ops B2B app, Linear-like shell" | Design thesis — "developer portfolio, editorial kinetic type" |
| **Variance dial** | Low–medium (2–6): hierarchy, signature in shell | Medium–high (6–10): layout breaks, hero bets |
| **Trend injection** | `production-trends.md` in recipes | `marketing-trends.md` in `recipe-landing.md` |
| **Signature bet** | Nav, empty state, ⌘K, table hover | Hero motif, scroll moment, type treatment |
| **Steering** | `/bolder` / `/quieter` | Same — "more experimental" / "more restrained" |
| **Gates** | Anti-slop + a11y always | Same — wow must not mean purple gradient slop |

**Craft Read** = unified name for the one-line thesis before any `/craft` (replaces separate "Product Read" vs "Design Read" split).

---

## The real gap (both tracks)

| Track | User says | We under-deliver because… |
|-------|-----------|---------------------------|
| **A** | "Dashboard looks like every AI admin" | Trends not wired at build; safe Graphite default |
| **B** | "Landing feels template-y" | `recipe-landing.md` is structural, not generative; no variance dial; inspiration.md loads at critique not craft |
| **Both** | "Feels boring" | Signature detail polish-gated; no `/bolder` |
| **Both** | "Other skills feel more designed" | Competitors lead with creative thesis + trend pools |

---

## What "creativity" means — two flavors, one system

### Production creativity (Objective A)

Editorial decisions in **repetitive UI** — not decoration:

- Metric hierarchy, row context, soft sidebar, optimistic UI, empty states with wit
- Feels like Linear / Notion / Stripe Dashboard, not 2022 card-grid admin

### Marketing creativity (Objective B)

Composition and **memorable first impression** — within anti-slop:

- Asymmetric heroes, bento grids, kinetic display type, scroll choreography (reduced-motion safe)
- Real product shots, proof strips, section variety — per `inspiration.md` archetypes
- Palette + font rotation so portfolios don't all look identical

**We borrow from Taste on Track B, not by abandoning Track A.**

---

## Audience

| User | Primary track | Also needs |
|------|---------------|------------|
| Developer, no design background | **A** — ship the app | **B** — when they need a landing for launch |
| Founder shipping v1 | **A** + **B** — product + marketing page |
| Agency / portfolio builder | **B** | **A** — if they build the app too |
| Team with designers | Both — gates + brief |

---

## Competitive stance (revised)

| Competitor | Learn | Don't copy wholesale |
|------------|-------|----------------------|
| **Taste** | Design Read, variance, palette rotation, marketing motion | Landing-only scope; refuse dashboards |
| **Impeccable** | bolder/quieter, live loop, emotional critique | Brand-first to exclusion of product |
| **ui-craft moat** | Gates + recipes + both tracks in one system | — |

**Unique position:** The only system that ships **production-grade app UI** and **creative marketing surfaces** with the same quality gates — not two separate skills.

---

## Success metrics

### Track A (production)
1. First-session pride on `/craft dashboard`
2. Template tell rate <5s (gray-950 sidebar, 4 identical cards…)
3. Passes MCP / anti-slop on dashboard fixtures

### Track B (marketing)
1. Landing/portfolio blind review: "would publish" not "would tweak"
2. Section variety — no two adjacent blocks same structure
3. Hero has one screenshot-worthy bet; passes anti-slop (no mesh-gradient default)

### Shared
4. Craft Read present in agent output before code
5. Non-designer steering works ("more like Linear", "more experimental")

---

## Implementation priority

**Shared foundation (do first)**
1. **Craft Read** — mandatory before any `/craft` (routes to A or B thesis style)
2. **DESIGN_VARIANCE knob** — gates creative amplitude; default by surface type
3. **`/bolder` / `/quieter`**
4. **Signature bet** on every `/craft` — not polish-gated

**Track A**
5. Wire `production-trends.md` → `recipe-dashboard.md`, auth, settings patterns
6. Theme + accent rotation for app shells

**Track B**
7. Wire `marketing-trends.md` → `recipe-landing.md`; strengthen portfolio guidance
8. Import Taste-inspired generative pools (fonts, palettes, hero archetypes) into build step
9. Expand `inspiration.md` usage at **craft time**, not only critique

**Measure**
10. Benchmark both tracks equally — see [benchmarks/PROMPTS.md](./benchmarks/PROMPTS.md)
