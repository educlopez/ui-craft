# ui-craft CLI

A static Go binary that installs and configures the [UI Craft](https://skills.smoothui.dev) design system into any AI agent harness — Claude Code, Cursor, Codex, Gemini, or OpenCode.

## What it does

`ui-craft install` detects your installed harnesses, walks you through a-la-carte component selection (skill+commands, MCP gates, review agents, design-memory), and writes each selected component into the harness's native config format. All writes are idempotent, backed up before they happen, and rolled back automatically on failure.

## Install

### macOS

```bash
brew install educlopez/ui-craft/ui-craft
```

### Windows (Scoop)

```powershell
scoop bucket add ui-craft https://github.com/educlopez/scoop-ui-craft
scoop install ui-craft
```

### Direct download

Download the binary for your platform from the [GitHub Releases page](https://github.com/educlopez/ui-craft/releases), extract the archive, and place the `ui-craft` binary on your `$PATH`.

## Usage

```
ui-craft install                          # detect harnesses, interactive TUI
ui-craft install --yes                    # non-interactive (CI / scripted)
ui-craft install --yes --force            # bypass native plugin coexistence warning
ui-craft install --harness cursor         # target a specific harness
ui-craft backup                           # snapshot harness configs without installing
ui-craft rollback cursor                  # restore latest backup for a harness
ui-craft update cursor                    # re-apply all installed components for cursor
ui-craft update cursor --component mcp-gates  # update one component
ui-craft version                          # print binary + mirror version
ui-craft version --check-parity          # verify Claude Code install matches expected surface
```

## Update lifecycle (state.json)

After a successful `install`, the CLI saves the selected harness+component choices to `~/.ui-craft/state.json`. This file is the single source of truth for `update`:

```
update cursor                   → re-applies all components recorded in state for cursor
update cursor --component mcp-gates  → re-applies only mcp-gates for cursor
```

If `state.json` is missing or malformed, `update` reports "nothing installed yet — run install first" and exits 0. It never crashes on a missing or corrupt state file.

User edits outside managed blocks are always preserved across updates. The managed-block and JSON-merge writers guarantee that only the ui-craft block is replaced; user content before and after the block is never touched.

The update is idempotent: if the embedded mirror already matches what is on disk (byte-for-byte), no file is written and the command reports "already up-to-date".

## Claude Code parity check

```bash
ui-craft version --check-parity
```

Verifies that the CLI install into Claude Code produced the expected surface:

- `skill` — at least one file under `~/.claude/skills/ui-craft/`
- `mcp` — `~/.claude/mcp/ui-craft.json` exists and is non-empty
- `agents` — at least one `.md` file under `~/.claude/agents/` (only when review-agents is installed)

Exits 0 when all checks pass; exits 1 when any check fails.

## Native plugin coexistence

If the Claude Code native plugin (`~/.claude/plugins/ui-craft/`) is detected during install, the CLI warns and requires `--force` to proceed:

```
WARNING: Native plugin detected — CLI install may overlap.
Both installs write to the same skills and agents directories.
To proceed anyway, re-run with --force.
```

The native plugin install and the CLI install are both valid alternative install paths. They can coexist but may write to the same directories.

## Versioning

The binary version matches the repo version that generated its embedded harness mirrors. This is the single coordinated version documented in `VERSIONS.md` (ADR-6): one semver tag, three release artifacts — Claude Code plugin, `ui-craft-mcp` npm package, and this binary.

```
ui-craft version
# ui-craft v0.35.0 (mirror: v0.35.0)
```

Both `version` and `mirror` should match on an official release. If they differ, the binary was built with stale mirrors — run `make gen-mirrors` before rebuilding.

## Build from source

```bash
# 1. Generate harness mirrors (requires Node)
make gen-mirrors

# 2. Build the binary
make build

# 3. Run all checks (build + vet + test + gofmt + agent-copy drift check)
make check
```

For a local snapshot release (requires [goreleaser](https://goreleaser.com)):

```bash
make release-local
```

## Design memory

Running `ui-craft install` with the `design-memory` component scaffolds a `.ui-craft/` directory in your project:

```
.ui-craft/
  brief.md        # always loaded by the skill — product, audience, voice
  tokens.md       # always loaded — color, type, spacing, radius tokens
  decisions.md    # lazy loaded — append-only design decision log
  patterns.md     # lazy loaded — reusable component/layout patterns
  surfaces/
    <name>.md     # lazy loaded — per-surface notes
```

Edit these files freely. The skill reads them as plain markdown — no memory product, no external service.

## Architecture

The binary is an installer only — no AI logic runs in Go. It embeds pre-generated harness mirrors (`go:embed`) produced by `sync-harnesses.mjs` at build time. All design rules stay in JS, served via `npx ui-craft-mcp` (wired into each harness's MCP config on install). See [design.md](../openspec/changes/v1-cli-system/design.md) for the full architecture.
