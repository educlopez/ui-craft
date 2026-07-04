# Contributing

Thanks for your interest in contributing to UI Craft. This guide covers the skill (craft rules + references + commands), the `ui-craft` CLI installer (`cli/`), the MCP quality-gate server (`mcp/`), and the `ui-craft-detect` npm CLI (`scripts/detect.mjs`).

## Requesting Changes

Suggest new rules, patterns, references, commands, or detector checks by [opening an issue](https://github.com/educlopez/ui-craft/issues/new).

## Project Structure

```
ui-craft/
├── skills/                         # Canonical skill sources (edit here)
│   ├── ui-craft/                   # Main skill
│   │   ├── SKILL.md                # Anti-slop test, craft test, routing, knobs, discovery
│   │   └── references/             # 32 domain references
│   ├── ui-craft-minimal/           # Variant — Linear / Notion aesthetic
│   ├── ui-craft-editorial/         # Variant — Medium / Substack aesthetic
│   └── ui-craft-dense-dashboard/   # Variant — Bloomberg / Retool aesthetic
├── commands/                       # 24 Claude Code slash commands (canonical source)
├── agents/                         # Review agents (design-reviewer, a11y-auditor)
├── cli/                            # ui-craft Go installer (embedded assets, TUI, backup/rollback)
│   └── assets/                     # Per-harness install tree (hand-authored, go:embed)
│       ├── claude/                 # skills/, commands/, agents/
│       ├── codex/ cursor/ gemini/ opencode/
│       └── agents/
├── mcp/                            # ui-craft-mcp server (4 deterministic gate tools)
├── scripts/
│   ├── detect.mjs                  # ui-craft-detect CLI (published to npm)
│   ├── eval.mjs                    # Quality-score baseline regression gate
│   └── validate.mjs                # Plugin manifest + link checker
├── .codex/ .agents/ .gemini/ .opencode/   # Repo-root harness mirrors (npx skills add)
├── examples/
├── evals/
├── .claude-plugin/
├── .github/workflows/
├── .githooks/pre-commit
├── RELEASE_CHECKLIST.md            # Manual steps CI cannot cover (e.g. Gatekeeper on Apple Silicon)
└── VERSIONS.md
```

### Where to edit (three asset trees)

Since v1.0.2 there is **no** `sync-harnesses.mjs` generator. Assets are hand-maintained in three places:

| Tree | Purpose | Edit when… |
|------|---------|------------|
| `skills/` + `commands/` + `agents/` | **Canonical source** | Always — this is where changes start |
| `cli/assets/<harness>/` | Embedded in the `ui-craft` binary at build time | Shipping a CLI release that installs updated skill/commands |
| `.codex/`, `.agents/`, `.gemini/`, `.opencode/` | Repo-root mirrors for `npx skills add` | Shipping skill-only distribution updates |

**Never edit harness mirror files in isolation.** Each mirror file carries a `HARNESS MIRROR` header pointing back to its canonical source. After editing `skills/` or `commands/`, copy the change into the relevant `cli/assets/<harness>/` paths and repo-root mirrors before merging.

CI enforces drift for review agents only: `agents/` must match `cli/assets/agents/claude/` (`make -C cli check-agent-copies`). Skill/command drift is not yet automated — keep mirrors in sync manually when you touch canonical sources.

## How to contribute

### Adding an anti-slop rule

Anti-slop rules live in the `### The Anti-Slop Test` section of `skills/ui-craft/SKILL.md`. Pattern:

```markdown
- Pattern description — brief reason why it's slop; what to do instead
```

Good rules are:
- **Observable** — you can spot it by scanning code
- **Specific** — names the exact pattern, not a vague principle
- **Actionable** — explains what to do instead
- **Not obvious** — adds value beyond what a senior designer already knows

Example:
```markdown
- Uniform border-radius on everything (same 16px on cards, inputs, buttons) — vary radii by element size: 4px inputs, 8px cards, 12px modals
```

### Adding a detector rule (`ui-craft-detect`)

Detector rules live in the `rules[]` array in `scripts/detect.mjs`. Data-driven — no new code paths:

- `id: "category/rule-name"` — namespaced (`a11y/`, `forms/`, `dataviz/`, `perf/`, `dark-pattern/`, `state/`, `copy/`, `tables/`)
- `severity: "critical" | "major" | "warn"`
- `scope: "line" | "file"`
- `match(line, ctx)` or `matchFile(content, lines)` returning the finding (or `null`)
- `fix_apply` only if the rule is unambiguously auto-fixable (most aren't — semantic changes need human judgment)

Good detector rules:
- **Regex-friendly** — no AST parsing
- **High-signal** — low false-positive rate
- **Clear fix message** — tells the user exactly what to change

Validate locally:

```bash
node scripts/detect.mjs .                 # should find 0 in this repo
node scripts/detect.mjs /path/to/test     # spot-check on synthetic input
node --test scripts/detect.test.mjs       # detector unit tests
```

After adding: bump `package.json` version, add a line to `VERSIONS.md`. The `release.yml` workflow publishes the GitHub release automatically. `npm publish` still manual (requires OTP).

### Adding a craft pattern

Craft patterns live in `### The Craft Test (What TO Do)` in `skills/ui-craft/SKILL.md`. These describe what top SaaS products actually do — patterns worth emulating. Reference observed pattern archetypes from `inspiration.md` rather than naming specific products. Brand exemplars drift; observed patterns hold.

### Improving a reference file

Reference files in `skills/ui-craft/references/` are the depth layer. When editing:

- Keep the tone — direct, opinionated, concrete examples
- Explain the **why**, not just the what
- Prefer code examples over abstract principles
- Don't contradict rules in `skills/ui-craft/SKILL.md`
- Cite sources by name (Nielsen, Fitts, Cleveland-McGill, Tufte, ColorBrewer) where the rule traces back to established research — credibility compounds

If the reference is duplicated under `cli/assets/*/skills/ui-craft/references/`, update those copies too when shipping a CLI release.

### Adding a new reference domain

If a whole new domain is genuinely needed:

1. Create `skills/ui-craft/references/your-domain.md`
2. Add a row in the `## Routing` table in `skills/ui-craft/SKILL.md`
3. Add a row in the `## Reference Files` index table
4. Keep the reference under 300 lines; add a table of contents if longer
5. Cross-link from related refs

**Two filters before proposing a new reference:**
- **Stack-agnostic?** Will the content apply across React, Vue, Svelte, vanilla, Astro, etc.?
- **Design-engineer-pure?** Is this the work of a design engineer, or is it product / marketing / growth territory? Those belong in sibling skills, not `ui-craft`.

### Adding a new slash command

Commands live in `commands/*.md`. Each needs YAML frontmatter with `description` and `argument-hint`. Follow the pattern in `commands/polish.md` or `commands/animate.md`:

1. Opening line: `{Verb} the UI at ` + "`$ARGUMENTS`" + `. Load the ` + "`ui-craft`" + ` skill.`
2. Steps / sections — terse imperative voice
3. Knob gating block if relevant, or a one-liner (`**Note:** {cmd} is knob-agnostic — {reason}`)
4. Explicit `references/*.md` pointers
5. Output block — either "edit code directly, print Review Format table" or "no code changes, critique only"

After adding a command, also materialize it in harness-specific layouts:
- **Claude / OpenCode:** `cli/assets/<harness>/commands/<name>.md`
- **Cursor / Codex / Gemini / Agents:** flat peer skill at `cli/assets/<harness>/skills/<name>/SKILL.md` (and the matching repo-root mirror)

### CLI changes (`cli/`)

The Go installer requires **Go 1.23+**. From `cli/`:

```bash
make test              # go test -race ./...
make check-agent-copies   # agents/ vs cli/assets/agents/claude/
make check             # build + vet + test + gofmt + agent copies
```

Integration tests use real filesystem fixtures (`*_realfs_test.go`). Prefer extending those over MemFS-only tests for installer paths.

Before a CLI release, see `RELEASE_CHECKLIST.md` for steps CI cannot automate (notably Gatekeeper on a real Apple Silicon Mac).

## Writing guidelines

- **Explain the why** — "tight letter-spacing on large headings" is a rule; "because default spacing looks loose at display sizes" is understanding
- **Avoid rigid MUSTs** — explain reasoning so the model can judge edge cases
- **Be framework-agnostic** — the skill adapts to Tailwind, CSS Modules, styled-components, vanilla CSS, SFC, and Astro; syntax translates, rules don't
- **Include concrete values** — "use 4px" beats "use a small radius"
- **Reference observed patterns by structure** — "240px fixed sidebar with 12px vertical padding" beats "a good sidebar" or naming a specific product
- **Cite original sources** where rules trace to established research

## Local dev checklist

Before opening a PR:

```bash
node scripts/validate.mjs              # manifests + links (96 checks)
node scripts/detect.mjs .              # self-scan — should be 0 findings
node --test scripts/detect.test.mjs    # detector tests
node scripts/eval.mjs --baseline         # quality-score regression gate
make -C cli check-agent-copies         # agent drift guard
make -C cli test                       # Go tests (requires Go 1.23+)
cd mcp && npm ci && npm test           # MCP server tests
```

Version bump (if you changed the detector or the skill surface):

1. Update the top entry in `VERSIONS.md` with a new `## vX.Y.Z` heading + date + summary
2. Bump `package.json` version if the detector changed
3. The `.githooks/pre-commit` hook auto-bumps `marketplace.json` CalVer on commit (macOS/Linux)

On push to main:
- `validate.yml` runs the validator + agent copy drift guard
- `cli-ci.yml` runs Go tests (path-filtered to `cli/**`)
- `mcp-test.yml` runs MCP + eval harness (path-filtered)
- `release.yml` creates a tag + GitHub release if VERSIONS.md has a new entry

## Submitting

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-change`)
3. Make your changes
4. Run the local dev checklist above
5. Test with at least one AI agent prompt (ask it to build a UI; verify your rule is followed)
6. Open a pull request

## Quality Checklist

- [ ] Rules include the pattern AND the reason (after the em dash)
- [ ] No contradiction with existing rules in `skills/ui-craft/SKILL.md` or reference files
- [ ] Concrete values and examples, not vague principles
- [ ] Tested with at least one AI agent prompt
- [ ] Harness mirrors updated if canonical `skills/` or `commands/` changed
- [ ] No sensitive data or credentials
- [ ] Follows existing tone and formatting
- [ ] Stack-agnostic and design-engineer-pure (the two filters above)

## License

MIT — see [LICENSE](LICENSE).
