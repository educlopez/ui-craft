# Output Quality Research

> **Branch:** `cursor/output-quality-research-c607`  
> **Status:** Phase 0 — competitive investigation (not implementation)  
> **North star:** [POSITIONING.md](./POSITIONING.md) — **dual objectives:** production apps (A) + creative landings/portfolios (B)  
> **Trend refs:** [production-trends.md](./production-trends.md) · [marketing-trends.md](./marketing-trends.md)

---

## Executive summary

ui-craft is stronger as a **design engineering system** (gates, heuristics, recipes, MCP score, finish-bar). Taste and Impeccable are stronger as **creative direction systems** — they tell the agent *what world to build* before they tell it *what not to do*.

**Product decision (dual objectives):**

- **A — Production apps:** dashboards, settings, auth — non-designers proud to demo (primary audience).
- **B — Marketing surfaces:** landings, portfolios, launches — creative, trend-aware, screenshot-worthy (also a goal; we under-invested here).

Both share **Craft Read**, variance dial, signature bets, and gates. We borrow generative direction from Taste on Track B without becoming landing-only.

The gap: we under-teach **trends and creative intent** on both tracks — while over-indexing on audit tables.

**Reframed hypothesis:** Users fall in love when (1) output matches surface type — **app feels like a 2025 product**, **landing feels publishable**, (2) **Craft Read** lets them steer in plain language, (3) a **signature bet** ships on first `/craft`, not only at polish, (4) gates still pass.

---

## What we measured

| Dimension | Taste Skill v2 | Impeccable | ui-craft (today) |
|-----------|----------------|------------|------------------|
| **Primary promise** | "Ship interfaces that don't look templated" | "Shared design vocabulary + live iteration" | "Ship designer-grade UI by default" |
| **Pre-build ritual** | **Design Read** one-liner (§0) | `/init` → PRODUCT.md + DESIGN.md | Discovery + knobs + optional `/brief` |
| **Creative dials** | VARIANCE / MOTION / DENSITY | brand vs product lane + bolder/quieter | CRAFT / MOTION / DENSITY (no variance) |
| **Scope honesty** | Landing, portfolio, redesign only | brand + product surfaces | everything (dashboard, auth, landing, chat…) |
| **Anti-slop** | Strong + pre-flight | 45 detector rules + hook | 33+ rules + MCP + detect CLI |
| **Build commands** | Implicit in skill | `/craft` + live loop | `/craft` + recipes |
| **Creative steering** | Dial inference + palette rotation | `/bolder`, `/quieter`, `/overdrive` | `/delight`, `/polish` (conservative) |
| **Critique framing** | Redesign audit protocol | "emotional resonance" explicit | hierarchy, clarity, anti-slop table |
| **User sees result** | Code + strong motion defaults | **Live Mode** in browser | Code (+ optional Playwright in audit) |
| **Default tone** | Opinionated, aesthetic, risky | Warm, product-aware | Technical, thorough, safe |

---

## Why competitors feel more "creative"

### 1. Taste Skill — generative direction before correction

**Design Read (Section 0)** forces the agent to say, before any code:

> *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind + Geist + restrained motion."*

ui-craft's Discovery is equivalent in *information gathered* but equivalent in *theater* — we collect tokens and knobs; we rarely **declare a creative thesis** the user can react to ("yes, that's the vibe" / "no, more editorial").

**DESIGN_VARIANCE (1–10)** is the missing dial. ui-craft's `VISUAL_DENSITY` controls data packing, not layout risk. At variance 8–10, Taste explicitly authorizes asymmetric heroes, scroll-pinned structures, kinetic type — the things users screenshot.

**Palette rotation bans** (e.g. premium-consumer beige+brass) are *generative*: they don't only forbid purple gradients; they **force** the agent to pick from alternative families (Cold Luxury, Forest, Cobalt+Cream…). ui-craft says "one accent, 90% neutral" but doesn't rotate *which* accent world to inhabit.

**Font opinions** go beyond "don't use Inter accidentally" — Taste discourages Lucide as default, pushes Phosphor/Hugeicons, and bans Fraunces/Instrument Serif as LLM tells. ui-craft says "Lucide is fine if consistent."

**Scope discipline:** Taste refuses dashboards. That focus makes the default output feel premium on the surfaces users judge first (landing, portfolio).

### 2. Impeccable — emotional loop + amplitude vocabulary

**`/impeccable init`** writes durable `PRODUCT.md` + `DESIGN.md` — audience, anti-references, voice. ui-craft has `.ui-craft/brief.md` but it's optional and reads like a spec, not a *personality contract*.

**`/bolder` and `/quieter`** are the steering wheel users actually use in conversation. ui-craft has `/delight` and `/polish` but they are gated, conservative, and framed as "don't add confetti."

**`/overdrive`** — technically extraordinary effects — has no ui-craft peer. Our motion ceiling is cautious (anti-bounce is correct; we may have over-corrected into timid).

**Live Mode** closes the feedback loop visually. Users don't fall in love with a scorecard; they fall in love when they *see* the hero move. Impeccable invested here heavily (browser extension, variants, accept-back-to-source).

**Critique explicitly names "emotional resonance."** ui-craft's critique lenses are hierarchy, clarity, anti-slop — valuable for PM handoff, less for "wow."

**Case studies on impeccable.style** sell the transformation. Our README has before/after screenshots but the *skill output* during a session is still table-heavy.

---

## What ui-craft already does better (keep)

| Strength | Why it matters |
|----------|----------------|
| MCP `score_ui` + finish-bar | Defensible quality for teams / CI — competitors are weaker here |
| Heuristic scorecard (Nielsen + laws + personas) | PM-ready audits Taste/Impeccable don't match |
| Recipe system (`dashboard`, `landing`, `auth`) | Repeatable production surfaces, not only marketing pages |
| State lattice + `/harden` + `/unhappy` | Real apps, not just heroes |
| Variant skills (minimal, editorial, dense-dashboard) | Locked knobs for known aesthetics |
| `inspiration.md` archetypes | Strong observational patterns — underused at build time |
| Anti-slop depth | We catch more failure modes |

**Do not trade technical rigor for vibes.** The goal is **rigor + a creative front door**.

---

## Gap map (user-facing output)

```
                    TECHNICAL ◄────────────────────────────► EMOTIONAL
                         │                                      │
    ui-craft today ──────┼──────────●                           │
                         │          (correct, scored, tabular)   │
                         │                                      │
    Taste Skill ─────────┼────────────────────●                 │
                         │          (thesis + variance + motion) │
                         │                                      │
    Impeccable ──────────┼──────────────────────────●           │
                         │          (live loop + bolder/quieter)│
                         │                                      │
    target ui-craft ─────┼───────────────────────────────●     │
                         │          (ship + enchant)             │
```

### Symptom → likely cause

| User says | Likely cause in ui-craft |
|-----------|--------------------------|
| "It's correct but generic" | No Design Read; hero follows recipe without a *bet* |
| "Feels like a checklist" | Commands end in Review Format tables, not a one-line intent recap |
| "Too safe / corporate" | CRAFT 7 + no VARIANCE dial; `/delight` motion-gated |
| "I wanted something with personality" | Signature detail is rule #12, often skipped until polish at CRAFT 8+ |
| "Other skills feel more designed" | Competitors push font/palette/motion defaults harder on first pass |
| "Dashboard looks like every AI admin" | Trends doc not wired into build; themes default to safe Graphite + no rotation |
| "I said modern but got 2022 card grid" | No trend layer; inspiration.md loaded at critique not craft |

---

## Proposed research phases

### Phase 1 — Instrument (production-first benchmark)

- [ ] Run **blind build benchmark** — see [benchmarks/PROMPTS.md](./benchmarks/PROMPTS.md). **Primary prompts are P1–P3 (production).** P4–P5 are secondary.
- [ ] Reviewers are **non-designer developers** where possible — "would you demo this?"
- [ ] Score outputs on: **first-impression wow**, **brief fit**, **technical correctness**, **would ship**, **user quote test** ("would you tweet this?")
- [ ] Capture *agent prose* not just UI — how much of the session is tables vs creative declaration?

### Phase 2 — Creative front door (skill changes)

Hypotheses to prototype:

1. **Craft Read** — mandatory one-liner before `/craft` (product OR marketing thesis).
2. **DESIGN_VARIANCE knob** — low default for apps, higher authorized for landings/portfolios.
3. Wire **[production-trends.md](./production-trends.md)** + **[marketing-trends.md](./marketing-trends.md)** into recipes.
4. **Signature bet** on every `/craft` — shell (A) or hero (B).
5. **`/bolder` / `/quieter`** — plain-language amplitude.
6. **Output contract** — Craft Read recap first; tables for audit commands only.
7. **Track B uplift** — Taste-inspired pools (palette, fonts, hero archetypes) at craft time.

### Phase 3 — Experience loop (bigger lift)

- [ ] **Live iteration** — evaluate feasibility of Impeccable-style browser loop vs Playwright MCP-only.
- [ ] **First-session enchantment** — `/craft landing` default variance 7 on first install (documented, overridable).
- [ ] **Case study pipeline** — structured before/after captures for skills.smoothui.dev.

### Phase 4 — Measure

- [ ] Extend eval harness: "enchantment" fixtures (subjective bands, like score baselines).
- [ ] User interviews / Discord — what made them stay after first `/craft`?

---

## Draft principles (for future skill edits)

1. **Declare before you decorate** — user must see the creative thesis and approve or steer.
2. **One bet in the hero** — every surface ships with one memorable decision in above-the-fold, not only at polish.
3. **Amplitude is a feature** — users need "bolder" in plain language; variance dial encodes it.
4. **Tables are for reviewers** — builders want code + a sentence of intent; audits stay behind `/critique` `/audit` `/finalize`.
5. **Rotate, don't just ban** — generative pools for fonts/palettes/compositions per brief class.
6. **Keep the gates** — enchantment must still pass anti-slop and a11y; wow without slop is the moat.

---

## Open questions (remaining)

1. ~~**Positioning**~~ — **Resolved:** dual objectives A + B. See [POSITIONING.md](./POSITIONING.md).
2. **Risk budget:** How bold can default dashboard be (accent tint cards, command palette) before non-designers call it "too much"?
3. **Live mode:** Invest in native live loop, or Playwright MCP + screenshot for iteration?
4. **Trend refresh cadence:** Quarterly `production-trends.md` update vs embedded in VERSIONS?
5. **Naming:** "Product Read" vs "Craft read" vs keep "Design Read" with product-scoped definition?

---

## References

| Source | URL |
|--------|-----|
| Taste Skill repo | https://github.com/Leonxlnx/taste-skill |
| Taste docs | https://www.tasteskill.dev/docs |
| Impeccable repo | https://github.com/pbakaus/impeccable |
| Impeccable site | https://impeccable.style |
| ui-craft inspiration | `skills/ui-craft/references/inspiration.md` |
| ui-craft delight | `commands/delight.md` |
| ui-craft craft pipeline | `commands/craft.md` |

---

## Next action (this branch)

1. Review this doc with maintainers — validate positioning and risk budget.
2. If approved: Phase 1 benchmark script + fixture prompts in `research/output-quality/benchmarks/`.
3. First implementation slice: **Craft Read + DESIGN_VARIANCE + wire both trend docs into recipes** — dashboard AND landing.
