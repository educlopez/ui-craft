# Output Quality Benchmark — Prompt Set

Use the same harness, model, and project context for each run. Capture: full UI output, agent prose (first 3 messages), time-to-first-render, and subjective scores.

## Scoring rubric (1–5 each)

| Criterion | 1 | 5 |
|-----------|---|---|
| **First-impression wow** | Template / AI slop | Screenshot-worthy hero |
| **Brief fit** | Ignores vibe words | Feels written for this brief |
| **Technical correctness** | Broken a11y/layout | Production-plausible |
| **Would ship** | Needs full redo | Merge with minor polish |
| **Tweet test** | Would not share | "Look what my agent built" |

## Prompts

### P1 — Linear-like dev tool landing
```
Build a landing page for "Relay" — a CI observability tool for platform teams.
Vibe: Linear-like, minimal, dark mode default. Primary CTA: start free trial.
```

### P2 — Awwwards portfolio
```
Build a portfolio homepage for a motion designer named Mika Tanaka.
Vibe: experimental, kinetic typography, scroll-driven reveals. No generic dark mesh gradient hero.
```

### P3 — Finance ops dashboard (ui-craft home turf)
```
Build an admin dashboard for accounts receivable: overdue invoices table, aging chart,
cash-collected KPI, filters by customer segment. Dense but readable.
```

### P4 — Redesign with constraints
```
Redesign the hero section only. Keep existing brand colors and logo.
Make it feel more premium and less template-y. [attach current hero screenshot or file path]
```

### P5 — Iteration steering
```
The page works but feels too safe and corporate. Make it bolder — more personality,
stronger typography, one memorable detail. Don't add slop.
```

## Systems to compare

- ui-craft (default skill, `/craft` where applicable)
- Taste Skill (`design-taste-frontend`)
- Impeccable (`/impeccable craft` or init + craft)

## Output template

```markdown
## Run: [system] × [prompt]

### Agent prose (creative thesis present? Y/N)
[paste]

### Scores
| wow | fit | tech | ship | tweet |
|-----|-----|------|------|-------|

### Notes
- What surprised (good/bad)?
- Table-heavy vs intent-first?
- Signature detail present in hero?
```
