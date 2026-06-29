# Proposal: v1 CLI System

## Intent

The full ui-craft **system** (skill + commands + review agents + MCP gates, all wired) is Claude-Code-only. Other harnesses (Cursor, Codex, Gemini, OpenCode) get only skill+commands via `npx skills add` — agents and MCP gates are not auto-wired. The experience is lopsided and ui-craft is still perceived as "just a skill." v1 makes ui-craft a real, installable, cross-harness **system** with a CLI as the core distribution path, while preserving the moat: design taste + a measurable score.

## Scope

### In Scope
- A **CLI installer/configurator** (core distribution path): detect harness(es), à la carte component selection, wire each into that harness's native config; installs into Claude Code too.
- CLI lifecycle: `install`, `update`, `backup`/rollback, per-component install/update.
- **Go → single static binary** (~10MB); distributed via Homebrew / Scoop / curl. TUI + Aren splash via the Charm stack (bubbletea / lipgloss).
- **À la carte components**: skill+commands (core), MCP gates (recommended — write `npx ui-craft-mcp` into each harness's MCP config), review agents (opt-in, native sub-agent format per harness), design memory.
- **Typed design memory**: evolve `.ui-craft/brief.md` into a directory — `brief.md` + `tokens.md` (always loaded), `decisions.md` (date-stamped log), `surfaces/{name}.md` (lazy-loaded), `patterns.md`.
- **Layered distribution**: native channels stay for discovery/SEO; CLI owns lifecycle + per-harness wiring.
- **Launch experience**: ASCII/ANSI splash of the Aren dog logo (`@clack/prompts` intro + ANSI art).

### Out of Scope
- Removing the native Claude Code plugin — it **stays** as a documented alternative install path (CLI or plugin, user's choice).
- Any persona component (rejected — the skill already is the scoped design persona, activating on UI intent; an always-on design persona is wrong since design work is intermittent).
- Any database, vector store, or named external memory product — design memory is plain markdown only.
- Reimplementing existing JS (sync-harnesses, detect, score, mcp) — reuse them.

## Capabilities

### New Capabilities
- `cli-installer`: harness detection, component selection, lifecycle (install/update/backup/rollback).
- `harness-wiring`: per-harness native config wiring for MCP gates, review agents, skill+commands.
- `design-memory`: typed `.ui-craft/` markdown directory (brief, tokens, decisions, surfaces, patterns).
- `cli-launch-experience`: ANSI Aren splash + prompt flow.

### Modified Capabilities
- None at spec level yet (no existing `openspec/specs/`). Distribution/plugin behavior is documented, not spec'd.

## Approach

CLI is a **Go** program compiled to one ~10MB static binary. Clean language boundary: **Go owns only the installer/configurator/TUI**; the runtime design logic stays in JS (skill content, `detect.mjs`, `score.mjs`, `ui-craft-mcp`) and is orchestrated, not embedded — the CLI runs `npx ui-craft-mcp` for gates and ships the pre-generated harness mirrors as embedded assets (`go:embed`) rather than running `sync-harnesses.mjs` at install time (that stays a build-time/CI step). It detects installed harnesses, prompts à la carte, and for each selected component writes the wiring into that harness's native config (MCP gates being the highest-value cross-harness win). The TUI + Aren splash use the Charm stack (bubbletea/lipgloss). Design memory ships as a scaffolded markdown directory the skill reads (always-loaded brief+tokens; lazy surfaces). Native marketplace channels remain for discoverability; the CLI owns lifecycle + wiring.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `cli/` (new) | New | Go CLI source (Charm TUI) + static-binary build; embeds pre-generated harness mirrors |
| `scripts/sync-harnesses.mjs` | Modified | Stays build-time; emits the mirrors the CLI embeds (not run at install time) |
| `.ui-craft/` schema | Modified | brief.md → typed directory |
| Homebrew tap / Scoop bucket | New | Binary distribution channels |
| Plugin docs | Modified | Reposition as alt install path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Per-harness agent-format mapping effort underestimated | Med | Agents are opt-in; ship MCP gates first, agents incrementally |
| Go is a second language for a JS-native maintainer | Med | CLI surface is small (file ops + config + TUI); no design logic in Go; Charm stack well-documented |
| Harness config drift breaks wiring | Med | `backup`/rollback + idempotent writes |
| Two install paths confuse users | Low | Docs default to CLI; plugin clearly labeled alternative |

## Rollback Plan

CLI `backup` snapshots each harness config before writing; `rollback` restores it. The native plugin path is untouched, so users can always fall back to it. New `cli/` and memory schema are additive — revert by not shipping the binary.

## Dependencies

- Go toolchain (cross-compile) + Charm libs (bubbletea/lipgloss) + `go:embed` for mirrors.
- Existing JS assets (orchestrated at runtime, not embedded in the binary): `detect.mjs`, `score.mjs`, `ui-craft-mcp`; `sync-harnesses.mjs` as a build-time mirror generator.
- Homebrew tap + Scoop bucket setup (open).

## Open Questions

- **Per-harness agent format**: which harnesses support native sub-agents, and mapping effort each?
- **Distribution setup**: Homebrew tap repo + Scoop bucket — owned where, released how?
- **Design-memory loading contract**: exact always-load vs. lazy-load boundary for the skill.
- **Mirror embedding**: how the build pipeline feeds `sync-harnesses.mjs` output into `go:embed` (CI step + versioning).

> Resolved (this revision): **Language = Go** (small static binary + mature packaging + Charm TUI; installer doesn't embed JS, so JS-reuse isn't a factor). **Persona = not shipped** (the skill is the scoped persona).

## Success Criteria

- [ ] One CLI install wires skill+commands + MCP gates into a non-Claude harness end-to-end.
- [ ] CLI installs the full system into Claude Code, matching today's plugin experience.
- [ ] `install`/`update`/`backup`/`rollback` work per-component and idempotently.
- [ ] Binary distributes via Homebrew, Scoop, and curl on macOS/Linux/Windows.
- [ ] Typed `.ui-craft/` memory scaffolds and is read by the skill.
- [ ] Native plugin path still works as documented alternative.
