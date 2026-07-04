# Output Quality Research

> **Branch:** `cursor/output-quality-research-c607`  
> **Status:** Phase 0 — competitive investigation (not implementation)  
> **Question:** Why do Taste Skill and Impeccable feel like they *enamoran* al usuario, while ui-craft often feels correct but cold?

---

## Executive summary

ui-craft is stronger as a **design engineering system** (gates, heuristics, recipes, MCP score, finish-bar). Taste and Impeccable are stronger as **creative direction systems** — they tell the agent *what world to build* before they tell it *what not to do*.

The gap is not "we lack rules." We have more rules than both. The gap is **generative intent**: a visible creative thesis, amplitude controls (`bolder` / quieter`), variance as a first-class dial, and output that leads with *feeling* before findings tables.

**Hypothesis:** Users fall in love with output that (1) surprises them once in the hero, (2) feels written for *their* brief not a checklist, (3) can be steered in plain language ("make it bolder"), and (4) is seen live — not only scored.

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
| "Dashboard is great, landing is meh" | Recipes are strong; creative thesis layer is weak on marketing surfaces |

---

## Proposed research phases

### Phase 1 — Instrument (1–2 weeks of thinking, not code yet)

- [ ] Run **blind build benchmark**: same 5 prompts × ui-craft vs Taste vs Impeccable (or manual adherence). Prompts:
  1. "Landing for a developer tool, Linear-like"
  2. "Portfolio for a motion designer, Awwwards energy"
  3. "Dashboard for finance ops" (ui-craft should win)
  4. "Redesign this hero — keep brand colors" (screenshot input)
  5. "Make it feel more premium" (iteration prompt)
- [ ] Score outputs on: **first-impression wow**, **brief fit**, **technical correctness**, **would ship**, **user quote test** ("would you tweet this?")
- [ ] Capture *agent prose* not just UI — how much of the session is tables vs creative declaration?

### Phase 2 — Creative front door (skill changes)

Hypotheses to prototype:

1. **Design Read** — mandatory one-liner before `/craft` and default Build mode (adapt Taste §0, ui-craft voice).
2. **DESIGN_VARIANCE knob** — separate from density; gates asymmetry, layout breaks, kinetic type.
3. **Creative brief block in `/craft` Step 2** — plan must include: thesis, one forbidden generic pattern, one signature bet, font pair from rotation pool.
4. **`/bolder` and `/quieter` commands** — amplitude without re-architecting; Impeccable-parity steering.
5. **`/overdrive` or extend `/animate`** — opt-in high-motion path with guardrails (reduced-motion still honored).
6. **Palette + font rotation tables** in `color.md` / `typography.md` — generative pools, not only bans.
7. **Output contract change** — after build, lead with *intent paragraph + screenshot request*; tables move to appendix unless user asked for audit.

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

## Open questions (need product input)

1. **Positioning:** Do we want ui-craft to win on landing/portfolio wow (Taste territory) or double down on "production app that feels designed" (less crowded)?
2. **Risk budget:** How far can default `/craft` push variance before anti-slop brand is harmed?
3. **Live mode:** Invest in native live loop, or standardize on Playwright MCP + screenshot critique?
4. **Command proliferation:** Add `bolder`/`quieter`/`overdrive` vs fold into `/adapt` + `/animate` + knob overrides?
5. **Naming:** "Design Read" vs ui-craft-native term ("Composition thesis", "Craft read")?

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
3. First implementation slice (suggested): **Design Read + `/craft` Step 2 creative block** — smallest diff, highest user-visible impact.
