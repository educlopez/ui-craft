# Product positioning — locked for this initiative

> **Decision (maintainer, 2026-07-04):** ui-craft does **not** pivot to portfolio/landing wow as primary territory. The north star is **production apps** — helping thousands of users **without design knowledge** ship interfaces that look and feel professionally designed.

Landings and portfolios were never a focus; that's fine. Taste Skill owns much of that aesthetic experimentation. Our opportunity is narrower and harder:

**Make everyday product UI feel designed — dashboards, settings, onboarding, tables, forms, empty states — without requiring the user to know what "good design" means.**

---

## The real gap (reframed)

The problem is not "we're too technical." Technical rigor is the moat for production apps (states, a11y, density, data viz, finish-bar).

The problem is: **we teach the agent what to avoid and how to verify, but we under-teach what today's good product UI feels like** — the trends, micro-decisions, and small creative bets that make Linear, Notion, Raycast, or a well-crafted Retool app feel alive instead of "correct admin template."

Non-designers don't ask for "DESIGN_VARIANCE 8." They ask for:
- "Make it look modern"
- "It works but feels boring"
- "Like Linear / Notion / Stripe Dashboard"
- "More personality but still professional"

We need to translate **creativity + trends** into **production-safe defaults** the agent applies automatically.

---

## What "creativity" means for us (not for Taste)

| In portfolio/landing skills | In ui-craft (production) |
|---------------------------|--------------------------|
| Kinetic hero typography | Confident type scale + one display moment (empty state, onboarding hero) |
| Scroll hijacking | Purposeful page transitions, optimistic UI, skeleton choreography |
| Mesh gradients, glass everywhere | Layered neutrals, one accent, tinted surfaces (`accent/5` cards) |
| Awwwards asymmetry | Sidebar rhythm, metric hierarchy, asymmetric feature rows in settings |
| Bold font pairing drama | Curated font pairs per theme preset (not Inter-by-default) |
| Full-bleed visual storytelling | Row context in tables, sparklines, status dots, command palette affordance |
| "Make it viral" | "Make it trustworthy on first open" |

**Creativity in production = editorial decisions in repetitive UI** — not decoration on a hero.

---

## Audience implication

| User | Needs from ui-craft |
|------|---------------------|
| Developer without design background | Defaults that already look current; no vocabulary required |
| Founder shipping v1 | Dashboard + auth + settings that don't embarrass in a demo |
| Team with designers | Gates + tokens + brief; designers steer, agent doesn't regress |
| Power user | `/bolder`, themes, variants — optional amplitude |

The skill must **feel creative on first `/craft dashboard`** without the user running five commands.

---

## Competitive stance

| Competitor | We learn from them | We do NOT copy |
|------------|-------------------|----------------|
| **Taste** | Design Read, palette rotation, dial inference | Landing-only scope, high-variance marketing layouts |
| **Impeccable** | `bolder`/`quieter`, init personality, live loop | Brand/marketing-first framing |
| **shadcn default** | Component quality floor | "Every app looks the same" |

**Win condition:** A user builds a CRUD admin panel and their coworker asks *"did you hire a designer?"* — not *"nice landing page."*

---

## Success metrics (draft)

1. **First-session pride** — user would demo the UI in a meeting without apologizing
2. **Template tell rate** — blind reviewers can't spot "AI admin" in <5s (sidebar gray-950, 4 identical cards, uppercase headers)
3. **Trend freshness** — outputs reference 2024–2026 product patterns (see `production-trends.md`), not 2022 card-grid SaaS
4. **Still passes gates** — enchantment doesn't regress MCP score / anti-slop on production fixtures
5. **Non-designer comprehension** — user can steer with "more like Notion" without knowing tokens

---

## Implementation priority (ordered)

1. **Product Read** — one-line thesis for *product* context (not marketing Design Read)
2. **Trend layer in recipes** — dashboard/auth/settings inject current patterns at build time
3. **Theme + font rotation** — generative pools in presets (expand `themes.md` beyond 4 static)
4. **Signature in product surfaces** — one memorable moment per app shell (nav, empty state, or primary table)
5. **`/bolder` / `/quieter`** — plain-language amplitude for non-designers
6. **Benchmark on production prompts** — de-emphasize portfolio in Phase 1

Landings stay supported via `recipe-landing.md` but are **not** the quality bar for this initiative.
