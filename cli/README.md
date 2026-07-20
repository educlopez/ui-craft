# ui-craft CLI

A static Go binary that installs and configures the [UI Craft](https://skills.smoothui.dev) design system into any AI agent harness — Claude Code, Cursor, Codex, Gemini, or OpenCode.

## What it does

`ui-craft install` detects your installed harnesses, walks you through a-la-carte component selection (skill+commands, MCP gates, review agents, design-memory), and writes each selected component into the harness's native config format. All writes are idempotent, backed up before they happen, and rolled back automatically on failure.

## Install

### macOS / Linux — recommended

```bash
curl -fsSL https://skills.smoothui.dev/install | bash
```

Detects your OS/arch, downloads the latest release, verifies its sha256 checksum, and installs the `ui-craft` binary.

### Windows — recommended

```powershell
irm https://skills.smoothui.dev/install.ps1 | iex
```

<details>
<summary>Alternative installs (Homebrew, Scoop, direct download)</summary>

**macOS (Homebrew):**
```bash
brew install --cask educlopez/tap/ui-craft
```

**Windows (Scoop):**
```powershell
scoop bucket add educlopez https://github.com/educlopez/scoop-bucket
scoop install educlopez/ui-craft
```

**Direct download:**

Download the binary for your platform from the [GitHub Releases page](https://github.com/educlopez/ui-craft/releases), extract the archive, and place the `ui-craft` binary on your `$PATH`.

</details>

## Usage

```
ui-craft install                          # detect harnesses, interactive TUI
ui-craft install --yes                    # non-interactive (CI / scripted)
ui-craft install --yes --force            # bypass native plugin coexistence warning
ui-craft install --harness cursor         # target a specific harness
ui-craft install --yes --json             # machine-readable JSON output
ui-craft install --yes --quiet            # suppress non-essential output
ui-craft backup                           # snapshot harness configs without installing
ui-craft backup list --json               # list snapshots as JSON
ui-craft rollback cursor                  # restore latest backup for a harness
ui-craft update cursor                    # re-apply all installed components for cursor
ui-craft update cursor --component mcp-gates  # update one component
ui-craft self-update                      # upgrade binary to latest GitHub release
ui-craft version                          # print binary + mirror version
ui-craft version --json                   # emit version+mirror as JSON
ui-craft version --check-parity          # verify Claude Code install matches expected surface
ui-craft doctor                           # health check
ui-craft doctor --json                    # health check as JSON (ok bool + checks array)
ui-craft completion zsh                   # generate zsh completion script
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

## Shell completions

`ui-craft` ships with shell completion support via Cobra. To enable completions:

### Zsh

```bash
ui-craft completion zsh > "${fpath[1]}/_ui-craft"
```

Or with Oh My Zsh:

```bash
ui-craft completion zsh > ~/.oh-my-zsh/completions/_ui-craft
```

### Bash

```bash
ui-craft completion bash > /etc/bash_completion.d/ui-craft
# or for a per-user install:
ui-craft completion bash >> ~/.bashrc
```

### Fish

```bash
ui-craft completion fish > ~/.config/fish/completions/ui-craft.fish
```

### PowerShell

```powershell
ui-craft completion powershell | Out-String | Invoke-Expression
```

## Scripting / CI integration

Global flags for script-friendly output:

| Flag | Effect |
|---|---|
| `--json` | Emit machine-readable JSON instead of human text. Implies non-interactive (no TUI). |
| `--quiet` | Suppress non-essential output; print only errors (stderr) and a final one-line outcome. |
| `--yes` | Skip interactive prompts; apply defaults. |

Example — CI install check:

```bash
result=$(ui-craft install --yes --json)
echo "$result" | jq '.targets[] | select(.status != "already-up-to-date")'
```

## Self-update

```bash
ui-craft self-update
```

Upgrades the binary to the latest GitHub release:
- If installed via **Homebrew** or **Scoop**, prints the correct package-manager command instead (`brew upgrade ui-craft` / `scoop update ui-craft`) and exits 0 — self-replacing a package-managed binary corrupts the manager's state.
- For **direct-download** installs: fetches the latest release, verifies the sha256 against `checksums.txt`, and atomically replaces the binary. On Windows, writes `ui-craft.new` and prints manual instructions (Windows cannot replace a running executable).
- If already at the latest version, reports that and exits 0.

```bash
ui-craft self-update --json
# {"updated":true,"from":"v0.35.0","to":"v0.36.0","method":"direct"}
```

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

The binary is an installer only — no AI logic runs in Go. It embeds hand-authored per-harness assets (`go:embed` from `cli/assets/<harness>/`). All design rules stay in JS, served via `npx ui-craft-mcp` (wired into each harness's MCP config on install). See `cli/assets/embed.go` and [CONTRIBUTING.md](../CONTRIBUTING.md) for the asset-tree layout.
