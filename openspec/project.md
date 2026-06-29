# ui-craft — Project Conventions (OpenSpec)

## What this is

ui-craft is a design-engineering system: design taste encoded as agent skills + commands, backed by a measurable, deterministic quality score. The moat is the combination of **design taste + a measurable score** — no competitor combines both.

## Shipped surface (v0.34.0)

- **Claude Code plugin**: skill + 22 commands + 2 read-only review agents + bundled `.mcp.json` (auto-wires the MCP server).
- **`npx skills add`**: skill + command sub-skills mirrored to `.codex/.cursor/.gemini/.opencode/.agents` by `scripts/sync-harnesses.mjs`.
- **`ui-craft-detect`**: npm CLI, anti-slop scanner (`detect.mjs`).
- **`ui-craft-mcp`**: published npm package — 4 deterministic gate tools (`check_anti_slop`, `tokens_lint`, `acceptance_bar`, `score_ui`).
- **`evals/quality/score.mjs`**: UICraftScore (deterministic 0-100 + grade); judged UsabilityScore via `/heuristic`.

## Conventions

- **Reuse existing JS assets** (`sync-harnesses.mjs`, `detect.mjs`, `score.mjs`, the mcp package) rather than reimplementing.
- **Design memory is native ui-craft markdown** — committable plain files. Never a database, vector store, or any named external memory product.
- **Keep the moat explicit** in every artifact: design taste + measurable score.

## OpenSpec layout

```
openspec/
├── project.md                 # this file
├── specs/                     # capability specs (created in spec phase)
└── changes/
    └── {change-name}/
        ├── proposal.md        # intent, scope, approach, risks
        ├── design.md          # technical design (design phase)
        ├── tasks.md           # work breakdown (tasks phase)
        └── specs/             # delta specs for modified capabilities
```
