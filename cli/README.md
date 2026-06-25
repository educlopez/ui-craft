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
ui-craft install                  # detect harnesses, interactive TUI
ui-craft install --yes            # non-interactive (CI / scripted)
ui-craft install --harness cursor # target a specific harness
ui-craft backup                   # snapshot harness configs without installing
ui-craft rollback cursor          # restore latest backup for a harness
ui-craft update cursor            # re-apply latest embedded mirrors
ui-craft version                  # print binary + mirror version
```

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
