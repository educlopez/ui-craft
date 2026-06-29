# Harness Wiring Specification

## Purpose

Harness wiring writes each selected ui-craft component into the target harness's NATIVE config
format. Components: `skill+commands`, `mcp-gates`, `review-agents`. Each harness has its own
config schema; wiring is harness-specific and must degrade gracefully when a component is
not supported.

## Harness × Component Support Matrix

The `Supports(component Component) bool` method on each `Harness` adapter is the **single source
of truth** for which components a harness accepts. The TUI greys out unsupported components;
`core.Plan` drops them with an explicit "skipped — channel limitation" note. The table below is
a human-readable projection of what each adapter's `Supports()` returns:

| Component      | Claude Code | Cursor | Codex | Gemini CLI | OpenCode |
|----------------|:-----------:|:------:|:-----:|:----------:|:--------:|
| skill+commands | MUST        | MUST   | MUST  | MUST       | MUST     |
| mcp-gates      | MUST        | MUST   | MUST  | MUST       | MUST     |
| review-agents  | MUST        | SKIP   | SKIP  | SKIP       | MUST     |
| design-memory  | MUST        | MUST   | MUST  | MUST       | MUST     |

SKIP = `Supports()` returns false → graceful skip with a printed message explaining why.
Only Claude Code and OpenCode support native sub-agents; Cursor, Codex, and Gemini report "agents
not available here" via the skip mechanism.

## Requirements

### Requirement: Skill+Commands Wiring (all harnesses)

The CLI MUST copy the pre-generated embedded mirror for the target harness into that harness's
native skills directory. The mirror is bundled at build time via `go:embed`; no network call is
made at install time.

#### Scenario: Install skill+commands into Cursor

- GIVEN Cursor is detected and skill+commands is selected
- WHEN `ui-craft install` runs
- THEN the embedded Cursor mirror is copied into Cursor's skills/rules directory and the CLI reports the destination path

#### Scenario: Mirror is current (no update needed)

- GIVEN the installed skill file matches the embedded mirror checksum
- WHEN the user runs `ui-craft update cursor --component skill+commands`
- THEN the CLI outputs "skill+commands: already up-to-date" and makes no file changes

---

### Requirement: MCP Gates Wiring

For harnesses that support MCP (Claude Code, Cursor, OpenCode), the CLI MUST write
`npx ui-craft-mcp` as an MCP server entry into the harness's native MCP config location.
The write MUST be additive (preserve existing entries) and MUST NOT duplicate an existing
`ui-craft-mcp` entry.

| Harness      | MCP Config Location                                    | Format         | Strategy            |
|--------------|--------------------------------------------------------|----------------|---------------------|
| Claude Code  | `~/.claude/mcp/ui-craft.json` (separate file per server) | JSON         | SeparateFiles       |
| Cursor       | `~/.cursor/mcp.json`                                   | JSON           | ConfigFile (merge)  |
| Codex        | `~/.codex/config.toml`                                 | TOML           | TOMLFile (upsert)   |
| Gemini CLI   | `~/.gemini/settings.json`                              | JSON           | MergeIntoSettings   |
| OpenCode     | `~/.config/opencode/opencode.json`                     | JSONC          | MergeIntoSettings   |

#### Scenario: Write MCP gate into Claude Code

- GIVEN Claude Code is selected and mcp-gates is selected
- WHEN install runs
- THEN `~/.claude/mcp/ui-craft.json` is created containing `{ "ui-craft": { "command": "npx", "args": ["-y", "ui-craft-mcp"] } }` and no other MCP server files in `~/.claude/mcp/` are removed or modified

#### Scenario: MCP gate already present (idempotent)

- GIVEN the harness's MCP config already contains a `ui-craft` server entry matching the expected value
- WHEN install runs with mcp-gates selected
- THEN the CLI outputs "mcp-gates: already configured" and does not modify the file

#### Scenario: MCP merge preserves existing user servers (merge-not-clobber)

- GIVEN Cursor's `~/.cursor/mcp.json` already contains `{ "mcpServers": { "my-other-tool": { "command": "node", "args": ["server.js"] } } }`
- WHEN install runs with mcp-gates selected for Cursor
- THEN `~/.cursor/mcp.json` contains both `"my-other-tool"` (unchanged) and `"ui-craft"` in `mcpServers`; the installer MUST NOT remove, overwrite, or alter the `"my-other-tool"` entry

#### Scenario: Write MCP gate into Codex (TOML)

- GIVEN Codex is selected and mcp-gates is selected
- WHEN install runs
- THEN the `[mcp_servers.ui-craft]` block is upserted into `~/.codex/config.toml` with `command = "npx"` and `args = ["-y", "ui-craft-mcp"]`; all other TOML keys are preserved

#### Scenario: Write MCP gate into Gemini CLI (merge)

- GIVEN Gemini CLI is selected and mcp-gates is selected
- WHEN install runs
- THEN the `ui-craft` server key is merged into `~/.gemini/settings.json` under `mcpServers`; all other keys in `settings.json` are preserved

---

### Requirement: Review Agents Wiring (Claude Code and OpenCode only)

Review agents MUST be written into Claude Code's and OpenCode's native sub-agent config formats.
`Harness.Supports(ReviewAgents)` returns `true` only for these two harnesses. For Cursor, Codex,
and Gemini, `Supports(ReviewAgents)` returns `false`; the CLI MUST skip and print a clear
explanation — these harnesses have no native sub-agent format.

#### Scenario: Install review agents into Claude Code

- GIVEN Claude Code is selected and review-agents is selected
- WHEN install runs
- THEN the review agent definitions are written to Claude Code's sub-agent config directory (`~/.claude/agents/`) and the CLI reports each agent installed

#### Scenario: Install review agents into OpenCode

- GIVEN OpenCode is selected and review-agents is selected
- WHEN install runs
- THEN the review agent definitions are written to OpenCode's agent config (`.opencode/agent/`) and the CLI reports each agent installed

#### Scenario: Review agents requested for Cursor — graceful skip

- GIVEN Cursor is the selected harness and review-agents is selected
- WHEN install runs
- THEN `Cursor.Supports(ReviewAgents)` returns false, the CLI prints "review-agents: not supported for cursor — skipped (no native sub-agent format)" and does not create any agent config files

#### Scenario: Review agents requested for Codex — graceful skip

- GIVEN Codex is the selected harness and review-agents is selected
- WHEN install runs
- THEN `Codex.Supports(ReviewAgents)` returns false, the CLI prints "review-agents: not supported for codex — skipped (no native sub-agent format)" and does not create any agent config files

#### Scenario: Review agents requested for Gemini CLI — graceful skip

- GIVEN Gemini CLI is the selected harness and review-agents is selected
- WHEN install runs
- THEN `Gemini.Supports(ReviewAgents)` returns false, the CLI prints "review-agents: not supported for gemini — skipped (no native sub-agent format)" and does not create any agent config files

---

### Requirement: Codex File-Based Wiring

Codex has no marketplace. Skill+commands for Codex MUST be written to the file-based
config locations: project `AGENTS.md` and/or `~/.codex/` user config, following Codex's
documented conventions.

#### Scenario: Install skill+commands into Codex

- GIVEN Codex is selected
- WHEN skill+commands is installed
- THEN the CLI writes the embedded Codex mirror to `~/.codex/` (or the project `AGENTS.md` if in a project context) and confirms the path

---

### Requirement: Graceful Skip and Reporting

Any component×harness combination in the SKIP column MUST not error. The CLI MUST print a
single-line skip notice per skipped component and continue. The exit code MUST remain 0 when
all requested work either completed or was gracefully skipped.

#### Scenario: Multiple skips in one install

- GIVEN Cursor is selected with skill+commands, mcp-gates, and review-agents all selected
- WHEN install runs
- THEN skill+commands and mcp-gates are installed, and the CLI prints one skip notice for review-agents ("not supported for cursor — skipped") then exits 0

#### Scenario: Supports() drives TUI state

- GIVEN Codex is detected and the TUI is showing component selection
- WHEN the component list is rendered for Codex
- THEN the review-agents row is greyed out and non-selectable because `Codex.Supports(ReviewAgents)` returns false; skill+commands, mcp-gates, and design-memory are selectable
