# ui-craft evals

This directory contains automated evaluation systems for ui-craft skills and tooling.

---

## Description optimization (`presets/`, `ui-craft.json`, etc.)

The `description` field in every skill's YAML frontmatter is the primary mechanism agents use to decide whether to invoke the skill. Bad description causes under-triggering or over-triggering.

`skill-creator` ships an automated description optimizer (`run_loop.py`) that evaluates the current description against a set of realistic queries, calls Claude with extended thinking to propose improvements, and iterates. See the per-file comments in the eval JSON files for query sets and status.

---

## `quality/` — UICraftScore design-quality harness

Added in v0.30.0. A deterministic 0-100 score for UI source files that composites three signals:

| Dimension | Source | Penalty |
|---|---|---|
| `anti_slop` | `scripts/detect.mjs` `scan()` | critical −8, major −4, warn −1 |
| `token_discipline` | `mcp/src/tokens-rules.mjs` `scanTokens()` | flat −2 per finding |
| `a11y` | `evals/quality/a11y-static.mjs` `scanA11y()` | critical −8, major −4 |

### Score formula

```
score = 100
       − (anti_slop_critical × 8) − (anti_slop_major × 4) − (anti_slop_warn × 1)
       − (token_findings × 2)
       − (a11y_critical × 8) − (a11y_major × 4)
score = clamp(score, 0, 100)
```

Grade thresholds: **A** ≥ 90 | **B** ≥ 80 | **C** ≥ 70 | **D** ≥ 60 | **F** < 60

Per-dimension subscore = 100 minus that dimension's own penalties, clamped [0, 100].

### Static a11y checks (distinct from detect.mjs)

| Rule | Severity | Pattern |
|---|---|---|
| `a11y/img-no-alt` | critical | `<img>` without `alt=` attribute |
| `a11y/non-semantic-interactive` | critical | `div/span` with `onClick` and no `role=` + no `tabIndex` |
| `a11y/positive-tabindex` | major | `tabIndex > 0` |
| `a11y/aria-invalid-no-describedby` | major | `aria-invalid="true"` without `aria-describedby` |
| `a11y/no-reduced-motion` | major | file-scoped: animation/transition without `prefers-reduced-motion` |

These are DISTINCT from `detect.mjs` rules — zero overlap, no double-counting.

### Running the harness

```bash
# Score a single file
node scripts/eval.mjs path/to/Component.tsx

# Score a directory
node scripts/eval.mjs src/components/

# JSON output (for tooling)
node scripts/eval.mjs path/to/file.tsx --json

# Regression gate — score all fixtures, assert within baselines.json bands
node scripts/eval.mjs --baseline

# Exit code: 0 = clean, 1 = below threshold / drift, 2 = arg error

# Run unit tests directly
node --test evals/quality/*.test.mjs
```

### Benchmark fixtures

Located in `evals/quality/fixtures/`:

| Category | Files | Expected score |
|---|---|---|
| `slop/` | ~4 files with intentional violations | ≤ 70 |
| `designer/` | ~4 clean, well-structured files | ≥ 80 |

Separation invariant: `min(designer scores) > max(slop scores)` — asserted in the regression test.

### `baselines.json`

Defines per-fixture expected score bands:

```json
{
  "version": "0.30.0",
  "fixtures": {
    "evals/quality/fixtures/slop/purple-gradient.tsx": { "scoreMin": 38, "scoreMax": 58 }
  }
}
```

Bands (not exact values) absorb minor rule weight adjustments.

### Regenerating baselines

When a rule change intentionally shifts scores:

```bash
node --input-type=module << 'EOF'
import { scoreUI } from './evals/quality/score.mjs';
// run scoreUI on each fixture, update baselines.json bands
EOF
```

Then update `baselines.json` with ±10 margin around the new observed scores and commit.

### Key files

| File | Role |
|---|---|
| `evals/quality/a11y-static.mjs` | Five static a11y checks (regex-based, zero deps) |
| `evals/quality/score.mjs` | Shared scoring core — `scoreUI(input)` |
| `evals/quality/score.test.mjs` | node:test suite (formula, a11y, regression, separation) |
| `evals/quality/baselines.json` | Per-fixture expected score bands |
| `evals/quality/fixtures/` | Benchmark corpus |
| `scripts/eval.mjs` | CLI + baseline regression gate |
