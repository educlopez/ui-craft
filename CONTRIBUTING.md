# Contributing

Thanks for your interest in contributing to UI Craft! This guide will help you improve the skill or suggest new rules.

## Requesting Changes

You can suggest new anti-slop rules, craft patterns, or improvements by [opening an issue](https://github.com/educlopez/ui-craft/issues/new).

## Project Structure

```
ui-craft/
├── skills/ui-craft/
│   ├── SKILL.md              # Main skill file — core rules, anti-slop, craft test
│   └── references/           # Deep-dive guides per domain
│       ├── accessibility.md  # WCAG, keyboard, focus, ARIA
│       ├── animation.md      # Easing, springs, timing, principles
│       ├── animation-orchestration.md  # Multi-stage sequences
│       ├── color.md          # Palettes, dark mode, tokens
│       ├── copy.md           # UX writing, errors, CTAs
│       ├── layout.md         # Spacing, grids, hierarchy, depth
│       ├── modern-css.md     # View Transitions, container queries
│       ├── performance.md    # Compositor, FLIP, scroll, layers
│       ├── responsive.md     # Breakpoints, touch zones, fluid
│       ├── review.md         # Systematic UI critique methodology
│       ├── sound.md          # Web Audio, UI sound design
│       └── typography.md     # Type scale, fonts, readability
└── assets/                   # Images for README
```

## How to Contribute

### Adding a new anti-slop rule

Anti-slop rules live in the `### The Anti-Slop Test` section of `skills/ui-craft/SKILL.md`. Each rule follows this pattern:

```markdown
- Pattern description — brief reason why it's slop; what to do instead
```

Good rules are:
- **Observable** — you can check for it by scanning code
- **Specific** — names the exact pattern, not a vague principle
- **Actionable** — explains what to do instead
- **Not obvious** — adds value beyond what a senior designer would already know

Example:
```markdown
- Uniform border-radius on everything (same 16px on cards, inputs, buttons) — vary radii by element size: 4px inputs, 8px cards, 12px modals
```

### Adding a craft pattern

Craft patterns live in `### The Craft Test (What TO Do)` in `skills/ui-craft/SKILL.md`. These describe what top SaaS products actually do — patterns worth emulating. Reference real products (Linear, Vercel, Stripe, Notion) when possible.

### Improving a reference file

Reference files in `skills/ui-craft/references/` contain deep-dive guidance per domain. When editing:

- Keep the same tone — direct, opinionated, with concrete examples
- Explain the **why**, not just the what
- Prefer code examples over abstract principles
- Don't contradict rules in the main `skills/ui-craft/SKILL.md`

### Adding a new reference domain

If you think a whole new domain is needed:

1. Create `skills/ui-craft/references/your-domain.md`
2. Add a routing entry in the `## Routing` table in `skills/ui-craft/SKILL.md`
3. Keep the reference under 300 lines; add a table of contents if longer

## Writing Guidelines

- **Explain the why** — "tight letter-spacing on large headings" is a rule; "because default spacing looks loose at display sizes" is understanding
- **Avoid rigid MUSTs** — explain reasoning so the model can judge edge cases
- **Be framework-agnostic** — the skill adapts to Tailwind, CSS Modules, styled-components, and vanilla CSS
- **Include concrete values** — "use 4px" beats "use a small radius"
- **Reference real products** — "like Linear's sidebar" is more useful than "a good sidebar"

## Submitting Your Contribution

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-change`)
3. Make your changes
4. Test locally with an AI agent (ask it to build a UI and check if your rule is followed)
5. Submit a pull request

## Quality Checklist

- [ ] Rules include the pattern AND the reason (after the em dash)
- [ ] No contradiction with existing rules in `skills/ui-craft/SKILL.md` or reference files
- [ ] Concrete values and examples, not vague principles
- [ ] Tested with at least one AI agent prompt
- [ ] No sensitive data or credentials
- [ ] Follows existing tone and formatting

## Questions?

Open an issue if you have questions or need help with your contribution.
