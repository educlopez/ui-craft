# Output Quality Benchmark — Prompt Set

**Priority:** Production app prompts (P1–P3) are the quality bar for this initiative.  
See [POSITIONING.md](../POSITIONING.md).

Use the same harness, model, and project context for each run. Capture: full UI output, agent prose (first 3 messages), and subjective scores.

**Ideal reviewer:** developer without formal design training — "would I demo this to my team?"

## Scoring rubric (1–5 each)

| Criterion | 1 | 5 |
|-----------|---|---|
| **First-impression pride** | Embarrassed to demo | Proud to show in a meeting |
| **Feels current (2024–26 product)** | 2022 card-grid admin template | Could pass for a shipped SaaS |
| **Brief fit** | Ignores "like Notion/Linear" | Nails the reference without copying slop |
| **Technical correctness** | Broken a11y / states | Production-plausible |
| **Non-designer steerability** | Needed design vocabulary | "Make it bolder" would work |

---

## Primary prompts (production — run these first)

### P1 — Ops dashboard (core territory)
```
Build an admin dashboard for a B2B tool that tracks overdue invoices and cash collected.
Include: sidebar nav, 3–4 KPI cards (one primary), a chart, and a data table with filters.
Vibe: modern SaaS, like Linear or Attio — professional, not flashy. Dark mode optional.
```

### P2 — Settings + profile (boring surface that must feel designed)
```
Build a settings page for a team collaboration app: profile, notifications, billing teaser,
and danger zone. Sidebar settings nav + content panels. Should feel as polished as Notion settings.
```

### P3 — Onboarding + empty states (non-designer first impression)
```
Build the first-run experience for a project management app: empty project list,
onboarding checklist (3 steps), and one empty state with a clear CTA.
No lorem ipsum — realistic copy.
```

---

## Secondary prompts (iteration + comparison)

### P4 — Steer without design vocabulary
```
The dashboard works but feels boring and generic. More personality — still professional,
something I'd be proud to demo. Not a marketing site.
```

### P5 — Reference steering (non-designer language)
```
Make it feel more like Stripe Dashboard — clean, confident numbers, subtle depth.
Keep it a production app, not a landing page.
```

### P6 — Landing (out of scope for quality bar — optional)
```
Build a landing page for a developer tool, Linear-like. 
Note: ui-craft supports this but production apps are the north star.
```

---

## Systems to compare

- ui-craft (`/craft dashboard` or default build)
- Taste Skill (note: may refuse dashboard — document behavior)
- Impeccable (`/impeccable craft`)

## Output template

```markdown
## Run: [system] × [prompt]

### Product Read / creative thesis present? (Y/N)
[paste agent's opening declaration if any]

### Scores
| pride | current | fit | tech | steer |
|-------|---------|-----|------|-------|

### Template tells (check any)
- [ ] Dark gray-950 sidebar
- [ ] 4 identical metric cards
- [ ] Uppercase section headers
- [ ] Purple gradient / glass hero in app shell
- [ ] Plain spreadsheet table (no row context)

### Signature detail in app shell? (Y/N — what?)

### Notes
```
