# Output Quality Benchmark — Prompt Set

**Dual objectives:** [POSITIONING.md](../POSITIONING.md) — run **Track A and Track B** prompts; both are quality-bar, not optional.

Use the same harness, model, and project context for each run.

## Scoring rubric (1–5 each)

| Criterion | 1 | 5 |
|-----------|---|---|
| **First-impression pride** | Embarrassed to show | Proud to publish / demo |
| **Feels current** | Generic AI template | Shipped-product quality |
| **Brief fit** | Ignores vibe references | Nails "like Linear" / "editorial portfolio" |
| **Technical correctness** | Broken a11y / states | Production-plausible |
| **Craft Read present** | Jumps to code | Declares thesis user can steer |

---

## Track A — Production apps

### A1 — Ops dashboard
```
Build an admin dashboard for a B2B tool that tracks overdue invoices and cash collected.
Include: sidebar nav, 3–4 KPI cards (one primary), a chart, and a data table with filters.
Vibe: modern SaaS, like Linear or Attio — professional, not flashy.
```

### A2 — Settings
```
Build a settings page for a team collaboration app: profile, notifications, billing teaser,
and danger zone. Should feel as polished as Notion settings.
```

### A3 — Onboarding + empty states
```
Build the first-run experience for a project management app: empty project list,
onboarding checklist (3 steps), and one empty state with a clear CTA. Realistic copy.
```

---

## Track B — Marketing surfaces (creative)

### B1 — Dev tool landing
```
Build a landing page for "Relay" — CI observability for platform teams.
Vibe: Linear-like, minimal, dark mode. Product-forward hero with real UI screenshot.
One conversion: start free trial. Section variety — no identical 3-col card grids.
```

### B2 — Designer portfolio
```
Build a portfolio homepage for a motion designer, Mika Tanaka.
Vibe: experimental but professional — kinetic display type, scroll reveals, editorial grid.
Not generic dark mesh gradient hero.
```

### B3 — Pre-launch waitlist
```
Build a waitlist landing for an AI writing tool aimed at founders.
Message-forward composition, email capture, social proof strip. Premium but not beige+craft cliché.
```

---

## Cross-track — Iteration

### I1 — Steer (production)
```
The dashboard works but feels boring. More personality — still professional, demo-ready.
```

### I2 — Steer (marketing)
```
The landing is correct but template-y. More creative — asymmetric hero, stronger typography.
Still anti-slop, no purple gradient mesh.
```

### I3 — Reference language (non-designer)
```
Make the dashboard feel more like Stripe Dashboard — confident numbers, subtle depth.
```

---

## Systems to compare

- ui-craft (`/craft dashboard`, `/craft landing`)
- Taste Skill (`design-taste-frontend`)
- Impeccable (`/impeccable craft`)

## Output template

```markdown
## Run: [system] × [prompt] — Track [A|B]

### Craft Read present? (Y/N)
[paste]

### Scores: pride | current | fit | tech | craft-read

### Template tells (check any)
- [ ] Track A: gray-950 sidebar, 4 identical cards, uppercase headers
- [ ] Track B: centered symmetric hero, 3-col icon grid, mesh gradient, generic CTA

### Signature bet? (Y/N — what?)

### Notes
```
