# Contributing

Thanks for your interest in contributing to UI Craft. This guide covers the skill (craft rules + references + commands) and the `ui-craft-detect` npm CLI (static anti-slop detector).

## Requesting Changes

Suggest new rules, patterns, references, commands, or detector checks by [opening an issue](https://github.com/educlopez/ui-craft/issues/new).

## Project Structure

```
ui-craft/
├── skills/
│   ├── ui-craft/                   # Main skill
│   │   ├── SKILL.md                # Anti-slop test, craft test, routing, knobs, discovery
│   │   └── references/             # 20 domain references
│   │       ├── accessibility.md    # WCAG, keyboard, focus, ARIA, forms, checklist
│   │       ├── ai-chat.md          # Streaming, tool traces, citations, generative UI
│   │       ├── color.md            # OKLCH, palettes, dark mode, tokens
│   │       ├── copy.md             # Voice / tone / locale / inclusive / microcopy
│   │       ├── dashboard.md        # Signal-to-noise, sidebar, metric cards, tables
│   │       ├── dataviz.md          # Cleveland-McGill, ColorBrewer, Tufte, small multiples
│   │       ├── forms.md            # Validation, wizards, autosave, field patterns
│   │       ├── heuristics.md       # Nielsen 10 + 6 design laws + scoring rubric
│   │       ├── inspiration.md      # Real patterns from dub, linear, vercel, stripe
│   │       ├── layout.md           # Spacing, grids, hierarchy, depth
│   │       ├── modern-css.md       # View Transitions, Anchor, Popover, <dialog>, color-mix
│   │       ├── motion.md           # Duration + easing tokens, choreography, budget
│   │       ├── performance.md      # Compositor, FLIP, will-change, CLS prevention
│   │       ├── personas.md         # 5 walkthroughs with checklists
│   │       ├── responsive.md       # Fluid sizing, mobile-first, safe areas
│   │       ├── review.md           # Critique methodology + Polish Pass
│   │       ├── sound.md            # Web Audio, appropriateness matrix
│   │       ├── stack.md            # Motion / GSAP / Three.js (opt-in)
│   │       ├── state-design.md     # State lattice — idle / loading / empty / error / ...
│   │       └── typography.md       # Scale, fonts, readability, essentials
│   ├── ui-craft-minimal/           # Variant — Linear / Notion aesthetic
│   ├── ui-craft-editorial/         # Variant — Medium / Substack aesthetic
│   └── ui-craft-dense-dashboard/   # Variant — Bloomberg / Retool aesthetic
├── commands/                       # 15 Claude Code slash commands (source)
├── examples/
│   ├── animation-storyboard.md     # Multi-stage animation pattern template
│   └── presets/
│       ├── playful.md              # Clay / Gumroad / Duolingo / Arc aesthetic
│       └── brutalist.md            # Swiss print / Nothing / terminal aesthetic
├── evals/                          # Eval query sets for description optimizer
│   └── presets/                    # Playful + brutalist eval JSONs
├── scripts/
│   ├── detect.mjs                  # ui-craft-detect CLI (published to npm)
│   ├── sync-harnesses.mjs          # Generates .codex / .cursor / .gemini / .opencode / .agents
│   └── validate.mjs                # Plugin manifest + link checker
├── .agents/skills/                 # AUTO-GENERATED — do not edit
├── .codex/skills/                  # AUTO-GENERATED
├── .cursor/skills/                 # AUTO-GENERATED
├── .gemini/skills/                 # AUTO-GENERATED
├── .opencode/skills/               # AUTO-GENERATED
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── .github/workflows/              # sync-harnesses / validate / release
├── .githooks/pre-commit            # Auto-version + detector on staged files
└── VERSIONS.md
```

**Never edit files under `.codex/`, `.cursor/`, `.gemini/`, `.opencode/`, `.agents/`.** They are regenerated from `skills/` and `commands/` by `node scripts/sync-harnesses.mjs` on every push to main (via GitHub Actions).

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
```

After adding: bump `package.json` version, add a line to `VERSIONS.md`. The `release.yml` workflow publishes the GitHub release automatically. `npm publish` still manual (requires OTP).

### Adding a craft pattern

Craft patterns live in `### The Craft Test (What TO Do)` in `skills/ui-craft/SKILL.md`. These describe what top SaaS products actually do — patterns worth emulating. Reference real products (Linear, Vercel, Stripe, Notion) where useful.

### Improving a reference file

Reference files in `skills/ui-craft/references/` are the depth layer. When editing:

- Keep the tone — direct, opinionated, concrete examples
- Explain the **why**, not just the what
- Prefer code examples over abstract principles
- Don't contradict rules in `skills/ui-craft/SKILL.md`
- Cite sources by name (Nielsen, Fitts, Cleveland-McGill, Tufte, ColorBrewer) where the rule traces back to established research — credibility compounds

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

## Writing guidelines

- **Explain the why** — "tight letter-spacing on large headings" is a rule; "because default spacing looks loose at display sizes" is understanding
- **Avoid rigid MUSTs** — explain reasoning so the model can judge edge cases
- **Be framework-agnostic** — the skill adapts to Tailwind, CSS Modules, styled-components, vanilla CSS, SFC, and Astro; syntax translates, rules don't
- **Include concrete values** — "use 4px" beats "use a small radius"
- **Reference real products** — "like Linear's sidebar" beats "a good sidebar"
- **Cite original sources** where rules trace to established research

## Local dev checklist

Before opening a PR:

```bash
node scripts/sync-harnesses.mjs   # regenerate harness mirrors
node scripts/validate.mjs         # check manifests + links (63/63 expected)
node scripts/detect.mjs .         # self-scan — should be 0 findings
```

Version bump (if you changed the detector or the skill surface):

1. Update the top entry in `VERSIONS.md` with a new `## v0.X.Y` heading + date + summary
2. Bump `package.json` version if the detector changed
3. The `.githooks/pre-commit` hook auto-bumps `marketplace.json` CalVer on commit

On push to main:
- `sync-harnesses.yml` regenerates mirrors if skills / commands / scripts changed
- `validate.yml` runs the validator
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
- [ ] No sensitive data or credentials
- [ ] Follows existing tone and formatting
- [ ] Stack-agnostic and design-engineer-pure (the two filters above)

## License

MIT — see [LICENSE](LICENSE).
