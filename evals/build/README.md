# Build evals — agent-backed

`evals/quality/` scores fixtures that never change. This scores what an agent **produces**,
which is the only way to test the half of ui-craft that is behaviour rather than text: not
whether a rule is written, but whether it was followed.

```bash
node scripts/eval-build.mjs --list
node scripts/eval-build.mjs --eval craft-dashboard-001 --experiment skill
node scripts/eval-build.mjs --suite benchmark --experiment skill,no-skill
```

## Why this exists

Before it, the most important gate in the repo was a markdown checklist that said *"Score
subjectively (pass/fail)"*. It was run once, by hand, against v0.8.0. It found three real
issues in two builds — a 32-word hero subtext against a ≤20 limit, a Craft Read emitted in
an improvised shape, and a table with no horizontal overflow — and every one of them had
been shippable for months because nothing measured it.

A rule nobody measures is a suggestion.

## Shape

```
evals/build/<id>/
  PROMPT.md              frontmatter (id, suite, track, surface) + the task the agent sees
  EVAL.mjs               default-exported scorer
  recorded/
    workspace/           a frozen build, for testing the scorer without an agent run
    transcript.txt       what that build said before writing code
    README.md            why this fixture is kept, and its expected verdict
```

An **experiment** is what the agent has available (`evals/build/_lib/experiments.mjs`). The
eval and the scorer are identical across experiments, so any difference in result is
attributable to the setup.

| Experiment | What it is |
|---|---|
| `skill` | Headless driver with the Skill tool available — ui-craft reachable |
| `no-skill` | Same driver, Skill tool blocked — the control arm |
| `recorded` | Scores a captured workspace, spends no agent run (via `--record`) |

## The two artifacts a scorer sees

A build produces files **and** a transcript, and scoring only the first misses half of what
the skill promises. "Output the Craft Read before writing code" cannot be checked against a
directory: the files look identical whether the agent declared its read or improvised
silently. That is precisely the failure the first audit found, and no file-based scorer would
ever have caught it.

So `ctx` gives both, plus helpers — `ctx.file()`, `ctx.find()`, `ctx.score()`, `ctx.detect()`,
`ctx.wordCount()` — and one rule: `ctx.check(name, pass, evidence)` **rejects an empty
evidence string**. A check with no evidence is not a check; a failure that cannot say what
decided it is not actionable.

`ctx.score()` grades file by file and reports the **minimum**, not the mean. A surface is
seen whole: one component with no focus states is a broken surface however clean its
neighbours are, and a mean lets eleven good files hide it.

## Recorded fixtures are kept failing on purpose

`craft-landing-001/recorded/` fails two checks and `craft-dashboard-001/recorded/` fails two.
They are the frozen v0.8.0 blind runs, and patching them would destroy their value.

A harness with only passing fixtures cannot tell you it still detects anything — stub every
check to `true` and the suite goes green. A known-bad build is what makes the scorers
falsifiable, and it is why `scripts/eval-build.test.mjs` can run in CI at zero cost and still
mean something.

## The `no-skill` arm

ui-craft's own `writing-skills` rubric says a line earns its place only if removing it changes
the output. Until this arm existed, the only way to test that was to read the skill and
imagine. Running one eval across both arms turns it into a diff.

**Known limit, stated because a quiet one would flatter the contrast:** `no-skill` blocks the
Skill tool, so the agent cannot pull ui-craft's instructions. It does *not* remove the skill's
name and description from the system prompt, which the harness injects for discovery. The arm
measures "instructions unavailable", not "skill absent". A true absent arm needs an isolated
`HOME`, which breaks CLI auth — not worth it for the signal.

## Cost

Every live pair is a full agent build: minutes, and real tokens. Select narrowly (`--eval` +
`--experiment`) and use `--record` for anything that does not need a fresh build. The test
suite deliberately spends nothing.

## Adding an eval

1. `evals/build/<id>/PROMPT.md` — frontmatter with `suite`, then the task, worded as a user
   would word it. No hints about what is being scored: a prompt that describes the checklist
   tests reading comprehension, not craft.
2. `evals/build/<id>/EVAL.mjs` — quote the reference each threshold comes from in a comment,
   so a failure names the rule rather than a number from nowhere.
3. Record one build into `recorded/` and add a `README.md` stating its expected verdict.
4. `scripts/eval-build.test.mjs` asserts every eval has all four; a missing one fails CI.
