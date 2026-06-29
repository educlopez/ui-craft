# CLI Launch Experience Specification

## Purpose

The `ui-craft` CLI MUST open with a branded ANSI/ASCII splash of the Aren dog logo rendered via
**lipgloss** (gradient color bands, no raw ANSI escape sequences embedded in the art asset) and
then guide the user through the install/update flow via an interactive **Bubble Tea** TUI.
The prompt flow is owned entirely by Bubble Tea; `@clack/prompts` is NOT used (it is a JS library
and the CLI is a Go binary). The experience MUST degrade gracefully on terminals without color support.

## Requirements

### Requirement: Brand Splash on Launch

Every invocation of `ui-craft install` or `ui-craft update` MUST render the Aren dog ASCII/ANSI
art logo followed by the product name and version before any prompts appear.
The splash MUST NOT be shown for non-interactive commands (`--help`, `--version`, `rollback`).

#### Scenario: Interactive launch renders splash

- GIVEN a color-capable terminal (TERM != "dumb", NO_COLOR unset)
- WHEN the user runs `ui-craft install`
- THEN the Aren dog braille/ASCII art is rendered through lipgloss gradient color bands, followed by "ui-craft vX.Y.Z", before any Bubble Tea prompt state appears

#### Scenario: Non-interactive command skips splash

- GIVEN any terminal
- WHEN the user runs `ui-craft --help` or `ui-craft --version`
- THEN no splash art is shown; only the requested output is printed

---

### Requirement: No-Color Degradation

The CLI MUST respect the `NO_COLOR` environment variable and the `TERM=dumb` convention.
When either is set, all ANSI escape codes MUST be omitted; the splash and prompts MUST remain
legible as plain ASCII text.

#### Scenario: NO_COLOR set

- GIVEN the environment variable `NO_COLOR=1` is set
- WHEN the user runs `ui-craft install`
- THEN the splash renders as plain ASCII without any ANSI color codes; prompts are plain text

#### Scenario: TERM=dumb

- GIVEN `TERM=dumb`
- WHEN the user runs `ui-craft install`
- THEN no escape sequences appear in stdout; the CLI remains fully functional

---

### Requirement: Interactive Prompt Flow

After the splash, the CLI MUST guide the user through a linear prompt flow using **Bubble Tea**
model/update/view states, styled with **lipgloss**. No JS prompt library (`@clack/prompts` or
similar) is used at any point. The states are:
1. Harness selection (multi-select, pre-checked detected harnesses)
2. Component selection (multi-select, pre-checked recommended defaults)
3. Confirmation summary (shows harness × component plan before writing)
4. Progress indicator per component as it is written

#### Scenario: Happy path prompt flow

- GIVEN a color terminal with Claude Code and Cursor detected
- WHEN the user runs `ui-craft install` and selects both harnesses with default components
- THEN the CLI shows: splash → harness selector → component selector → confirmation summary → per-component progress → success message

#### Scenario: User cancels at confirmation

- GIVEN the confirmation summary is shown
- WHEN the user presses Ctrl+C or selects "Cancel"
- THEN the CLI exits cleanly (exit code 0) without writing any files

#### Scenario: Non-TTY / piped output

- GIVEN stdout is not a TTY (e.g., piped to a file or run in CI)
- WHEN `ui-craft install` is run without `--yes` flag
- THEN the CLI exits with an error "Interactive mode requires a TTY; use --yes to skip prompts"

---

### Requirement: --yes Flag for Non-Interactive Install

The CLI MUST support a `--yes` flag that accepts all defaults and skips interactive prompts,
enabling use in CI/CD pipelines and scripted installs.

#### Scenario: Automated install with --yes

- GIVEN the `--yes` flag is passed
- WHEN `ui-craft install --yes` is run in a non-TTY environment
- THEN the CLI installs all recommended components (skill+commands + mcp-gates) for all detected harnesses without prompting, reporting progress to stdout
