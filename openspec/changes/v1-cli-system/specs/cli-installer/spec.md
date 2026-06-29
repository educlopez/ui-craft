# CLI Installer Specification

## Purpose

The `ui-craft` CLI is a single static Go binary that detects installed AI coding harnesses,
offers à la carte component selection, and manages the full lifecycle (install, update,
backup, rollback) of ui-craft components per harness.

## Requirements

### Requirement: Harness Detection

The CLI MUST detect which AI coding harnesses are installed on the user's machine at startup.
Detection MUST cover: Claude Code, Cursor, Codex, Gemini CLI, and OpenCode.
Detection is based on well-known config-file or binary presence; it MUST NOT require network access.

#### Scenario: All harnesses present

- GIVEN multiple harnesses (Claude Code + Cursor) are installed
- WHEN the user runs `ui-craft install`
- THEN the CLI lists all detected harnesses and prompts the user to select one or more

#### Scenario: No harnesses detected

- GIVEN no supported harness is installed
- WHEN the user runs any lifecycle command
- THEN the CLI exits with a clear error message naming the supported harnesses and exit code 1

#### Scenario: Single harness present

- GIVEN exactly one harness is installed
- WHEN the user runs `ui-craft install`
- THEN the CLI pre-selects that harness and proceeds to component selection without an extra prompt

---

### Requirement: À la Carte Component Selection

The CLI MUST present an interactive multi-select prompt listing available components:
`skill+commands` (core), `mcp-gates` (recommended), `review-agents` (opt-in), `design-memory`.
The user MAY select any subset. Selecting zero components MUST be rejected with a prompt to retry.

#### Scenario: Default recommended selection

- GIVEN the interactive prompt is shown
- WHEN the user accepts defaults without changing the selection
- THEN `skill+commands` and `mcp-gates` are selected

#### Scenario: Opt-in only review-agents

- GIVEN the interactive prompt is shown
- WHEN the user explicitly selects only `review-agents`
- THEN only review-agent wiring is performed; no other components are touched

#### Scenario: Zero components selected

- GIVEN the multi-select prompt is shown
- WHEN the user deselects all components and confirms
- THEN the CLI shows an error "Select at least one component" and re-shows the prompt

---

### Requirement: Idempotent Install

Running `ui-craft install` on a harness where a component is already installed MUST NOT duplicate
config entries or overwrite files unnecessarily. The CLI MUST detect existing installs and report
them as "already installed / up-to-date" without side effects.

#### Scenario: Re-run on already-installed harness

- GIVEN skill+commands were previously installed into Claude Code
- WHEN the user runs `ui-craft install` and selects the same component
- THEN the CLI outputs "skill+commands: already installed" and exits without modifying any file

#### Scenario: Partial install (some components missing)

- GIVEN skill+commands are installed but mcp-gates are not
- WHEN the user runs `ui-craft install` and selects both
- THEN only mcp-gates are written; skill+commands show "already installed"

---

### Requirement: Backup Before Write

Before modifying any harness config file, the CLI MUST create a timestamped backup.
Backups MUST be stored in `~/.ui-craft/backups/{harness}/{timestamp}/`.

#### Scenario: Backup created on install

- GIVEN Claude Code's `.mcp.json` exists
- WHEN `ui-craft install` writes mcp-gates
- THEN a copy of the original `.mcp.json` is saved to `~/.ui-craft/backups/claude-code/{ISO-timestamp}/mcp.json` before the write

#### Scenario: Backup skipped when no prior file

- GIVEN a harness has no pre-existing MCP config file
- WHEN install creates the file for the first time
- THEN no backup is created and the CLI does not error

---

### Requirement: Rollback Restores Prior Config

`ui-craft rollback {harness} [--component {name}]` MUST restore the most recent backup for the
specified harness and component, removing all changes made by the last install or update.

#### Scenario: Full harness rollback

- GIVEN a backup exists for Claude Code from a previous install
- WHEN the user runs `ui-craft rollback claude-code`
- THEN all config files for Claude Code are restored to the backed-up state and the user sees a confirmation

#### Scenario: No backup available

- GIVEN no backup exists for the specified harness
- WHEN the user runs `ui-craft rollback cursor`
- THEN the CLI exits with "No backup found for cursor" and exit code 1

---

### Requirement: Transactional Install (All-or-Nothing)

`core.Apply` MUST be transactional: before any file write it snapshots all target files, then
applies writes in sequence. If any write in the plan fails, ALL already-written files MUST be
restored from the snapshot and any files the installer created (that did not exist before the
plan began) MUST be deleted. A partial install MUST NEVER be left on disk.

#### Scenario: Mid-plan failure triggers full rollback

- GIVEN an install plan with three write targets (skill mirror, MCP config, design-memory scaffold)
- WHEN the second write (MCP config) fails mid-plan (e.g., permission error)
- THEN the first write (skill mirror) is restored to its pre-install content, the MCP config is left unchanged (no partial write), and no design-memory files created by the current plan remain on disk; the CLI exits with a non-zero code and reports which target caused the failure

#### Scenario: Newly created files deleted on rollback

- GIVEN a harness has no pre-existing MCP config file before the install
- WHEN the installer creates `~/.cursor/mcp.json` and a subsequent write in the same plan fails
- THEN `~/.cursor/mcp.json` is deleted (not just emptied) because `existedBefore` was recorded as false in the backup manifest

---

### Requirement: Per-Component Update

`ui-craft update {harness} [--component {name}]` MUST update only the specified component(s)
to the latest embedded mirror, without touching other components. A backup MUST be taken before
any file is overwritten.

#### Scenario: Update single component

- GIVEN skill+commands v0.20 is installed in Cursor
- WHEN the user runs `ui-craft update cursor --component skill+commands`
- THEN only the skill files are replaced with the latest embedded mirror; mcp-gates are untouched

#### Scenario: Update all components for a harness

- GIVEN all components are installed in OpenCode
- WHEN the user runs `ui-craft update opencode`
- THEN all installed components are updated in sequence; a backup is taken before each write

---

### Requirement: Claude Code Install Parity

Installing ui-craft into Claude Code via the CLI MUST produce a result equivalent to the
native plugin install: skill+commands, MCP gates, and review agents (if selected) MUST all be
wired correctly. The native plugin path MUST remain a documented alternative; the CLI does not
remove or conflict with an existing plugin install.

#### Scenario: CLI install matches plugin output

- GIVEN Claude Code is detected and all components are selected
- WHEN `ui-craft install` completes
- THEN the skill is present in the Claude Code skills dir, `.mcp.json` contains `npx ui-craft-mcp`, and review agents are present in the native sub-agent config

#### Scenario: Existing plugin install detected

- GIVEN the Claude Code plugin is already installed
- WHEN the user runs `ui-craft install` targeting Claude Code
- THEN the CLI warns "Native plugin detected — CLI install may overlap" and requires confirmation before proceeding
