# Description optimization evals

The `description` field in every skill's YAML frontmatter is the primary mechanism agents use to decide whether to invoke the skill. Bad description → the skill under-triggers (agent ignores it) or over-triggers (agent uses it for unrelated work).

`skill-creator` ships an automated description optimizer (`run_loop.py`) that:

1. Evaluates the current description against a set of realistic queries (some should trigger, some shouldn't).
2. Calls Claude with extended thinking to propose improvements based on failures.
3. Iterates, picking the best description by **held-out test score** (to avoid overfitting).

This folder holds the eval query sets for each skill.

## Files

| File | Skill | Status |
|------|-------|--------|
| `ui-craft.json` | `skills/ui-craft/` (the main skill) | 20 queries — ready to run |
| `ui-craft-minimal.json` | `skills/ui-craft-minimal/` | TODO — clone the pattern |
| `ui-craft-editorial.json` | `skills/ui-craft-editorial/` | TODO |
| `ui-craft-dense-dashboard.json` | `skills/ui-craft-dense-dashboard/` | TODO |

Each JSON is an array of `{query, should_trigger}`. The file format matches what `run_loop.py` expects.

## Running the optimizer

Requires `claude-code` CLI in PATH (script uses `claude -p` under the hood).

```bash
# Point these at your local skill-creator install.
SKILL_CREATOR=~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
MODEL=claude-opus-4-7

python -m scripts.run_loop \
  --eval-set evals/ui-craft.json \
  --skill-path skills/ui-craft \
  --model "$MODEL" \
  --max-iterations 5 \
  --verbose \
  --cwd "$SKILL_CREATOR"
```

The script splits the eval into 60% train / 40% held-out test, runs each query 3× for statistical stability, and outputs `best_description` as JSON. Apply it by updating the skill's `SKILL.md` frontmatter.

**Expected runtime:** 10-30 minutes per skill (proportional to query count × iterations × 3 runs each).

## Writing new eval sets

Per `skill-creator`:

- **20 queries total**, mixing 10 should-trigger and 10 should-not-trigger.
- **Should-not are the near-misses.** "Write a fibonacci function" is useless as a negative test for a design skill — too easy. Good negatives share vocabulary with the skill's domain but need something else: e.g., for `ui-craft`, "write unit tests for the auth service" is better because it contains "service" and "tests" but is clearly backend.
- **Realistic prompts.** Include file paths, company context, minor typos, casual punctuation. Queries that start with "ok so" or "i need to" are fine.
- **Different phrasings of the same intent** — formal vs casual, keyword-heavy vs indirect. Covers phrasing drift.

For **variant** skills (`ui-craft-minimal`, `ui-craft-editorial`, `ui-craft-dense-dashboard`), the key discriminator queries are:

- **Should-trigger**: mentions a style anchor specific to this variant ("Linear-like", "Medium-like", "Retool-like", "editorial", "dashboard") or an example product in the variant's reference set.
- **Should-NOT-trigger**: generic UI work (should route to main `ui-craft`) OR mentions a different variant's anchor ("make this dashboard minimalist" → should trigger `ui-craft-dense-dashboard`, not `ui-craft-minimal`, because "dashboard" is the dominant signal).

Cross-variant discriminators are the highest-signal negatives.
