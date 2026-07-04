# Marketing surface trends — landings, portfolios, launches

Reference for **Objective B** in [POSITIONING.md](./POSITIONING.md).  
Complements [production-trends.md](./production-trends.md) (Objective A).

Goal: creative landings and portfolios that **enamoran** — without Taste's landing-only scope. Wired into `recipe-landing.md`, `/craft landing`, and high-variance builds.

---

## 1. Craft Read for marketing (before code)

Agent must declare (example):

> *"Reading this as: B2B devtool launch page for technical buyers — product-forward hero, Graphite + indigo, variance 7, asymmetric split hero with real screenshot cropped at fold."*

Infer from: page kind, vibe words ("editorial", "Awwwards", "Linear-like"), references, audience.

---

## 2. Hero archetypes (pick one — from inspiration.md)

| Archetype | When | Creative lever |
|-----------|------|----------------|
| **Product-forward** | Live product to show | Cropped screenshot, floating proof card |
| **Message-forward** | Pre-launch / waitlist | Centered type + asymmetric proof offset |
| **Proof-forward** | Sales-led B2B | Modest hero, metrics strip dominates |
| **Bento grid** | Breadth of features | Mixed cell sizes, real UI in each tile |
| **Editorial figure** | Dev / technical brand | FIG labels, monospace accents |
| **Social proof strip** | Strong logo list | Scrolling monochrome logos below hero |

**Rule:** No two adjacent sections share the same layout structure.

---

## 3. Typography & voice (marketing allows more drama)

| Trend | Implement | Avoid |
|-------|-----------|-------|
| **Display scale** | 48–80px H1, tight tracking, sentence case | ALL CAPS hero |
| **Font pairing** | Display + body from rotation pool (Geist, Cabinet, Satoshi, IBM Plex…) | Inter everywhere |
| **Kinetic emphasis** | Italic/bold same family — not random serif word in sans headline | Fraunces/Instrument Serif as default |
| **Em-dash** | Use sparingly; prefer period or colon in headlines | Em-dash every subhead (LLM tell) |
| **Specific copy** | "Cut deploy time from 7m to 40s" | "Revolutionary platform" |

---

## 4. Layout & composition (variance-gated)

| Variance | Authorized |
|----------|------------|
| **4–6** | Split hero, alternating feature rows, proof strip |
| **7–8** | Asymmetric offsets, bento hero, scroll-linked logo strip |
| **9–10** | Kinetic type, scroll-pinned sections, experimental grid breaks — **opt-in or explicit brief** |

Always: `prefers-reduced-motion` honored; no scroll hijacking that traps users.

---

## 5. Color & material (marketing)

| Trend | Implement | Avoid |
|-------|-----------|-------|
| **90% neutral + one accent** | Same discipline as product — accent budget 3–5/viewport | Purple-cyan mesh gradient default |
| **Palette rotation** | Pick family per brief (see Taste-inspired pools in POSITIONING) | Beige+brass on every "premium" brief |
| **Tinted depth** | Layered shadows, hairline borders | Glassmorphism on everything |
| **Dark mode** | Intentional dual theme, not gray-900 + glow | Neon glow on dark |

---

## 6. Motion (marketing can breathe more)

| Moment | Production-safe marketing motion |
|--------|----------------------------------|
| Hero entrance | Stagger headline + CTA, 50–80ms, once |
| Logo strip | CSS scroll loop, pause on hover |
| Feature rows | Subtle fade-up on scroll, one per section max |
| Hover | Multi-property card hover on **one** featured block |
| Page | View Transitions API if stack supports — optional |

**Never:** bounce easing, idle float on static content, confetti.

---

## 7. Portfolio-specific

| Pattern | Detail |
|---------|--------|
| **Work grid** | Variable aspect ratios — not uniform 3-col cards |
| **Case study entry** | One hero project above fold; rest in editorial grid |
| **About / contact** | Asymmetric, not centered template |
| **Motion designer** | Scroll-driven reveals OK at variance 8+; still reduced-motion fallback |
| **Developer portfolio** | Code aesthetic: mono accents, FIG-style labels, terminal motifs subtle |

---

## 8. Signature bets (marketing — pick one per page)

1. **Hero crop** — product shot cut mid-element at fold edge
2. **Floating proof card** over screenshot (live metric, notification)
3. **Custom section marker** — FIG 0.1, domain icon motif
4. **Distinctive CTA** — not "Get started" / "Learn more"
5. **One scroll moment** — logo strip or pinned headline (variance 7+)

---

## 9. What we import from Taste (explicitly)

- Brief inference → **Craft Read**
- DESIGN_VARIANCE / MOTION / DENSITY dials for marketing builds
- Palette rotation bans (anti-beige-brass default)
- Pre-flight before ship
- Redesign audit protocol for existing sites

## 10. What stays ui-craft (not Taste)

- Dashboard / app recipes remain first-class
- MCP gates on all output
- `inspiration.md` archetypes as source of truth (not competitor copy)
- Anti-slop non-negotiable

---

## Skill integration checklist (Track B)

- [ ] `recipe-landing.md` — load this file at Step 0; variance default by page kind
- [ ] `commands/craft.md` — Craft Read branches: product vs marketing thesis
- [ ] New or expanded portfolio recipe / preset (playful, brutalist exist in examples/)
- [ ] `inspiration.md` — cross-link hero archetypes at build time
- [ ] Benchmark P4–P6 as **primary** for Track B, not optional
