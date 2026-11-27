# Cross-host validation — 2026-11-27

Local candidate only. No commit, publication, marketplace update or submission.
The Claude Directory skills-only candidacy and current installation pins are unchanged.

## Linux ARM64

The Linux and authenticated-host measurements below refer to the archive hashes
in `VALIDATION-RESULTS.json` under `artifacts`, before the later lifecycle fix.
They are historical evidence, not new host trials of the revised runtime.

Tested in disposable Debian Bookworm containers on Docker Desktop's Linux/arm64
kernel, as an unprivileged user with an init process to reap descendants. The
host checkout was not mounted writable. A fixture Git index supplied the tracked
source allowlist; no commit was created.

| Runtime | Unit tests | Extracted-package tests |
| --- | --- | --- |
| Node 20.20.2 | 32 pass, one Windows-only skip | 6 pass |
| Node 22.23.5 | 32 pass, one Windows-only skip | 6 pass |
| Node 24.22.3 | 32 pass, one Windows-only skip | 6 pass |

Node 20/22 binaries came from official nodejs.org archives and were checked
against the published SHA256 sums. The five generated package archive hashes
match between the clean Linux build and macOS.

The clean environment exposed two issues now fixed in the candidate:

- Canonical sources accidentally resolved Zod from the Mac's existing
  `mcp/node_modules`. The build now resolves it from the candidate's pinned
  dependency tree; an outside-package fixture tests that boundary.
- Debian's Python 3.11.2 lacks `tarfile.extractall(filter=...)`. The test harness
  now extracts validated regular files without restoring ownership or links.
  Regressions reject traversal, absolute paths, links and duplicates before any write.

The standard Chromium render check fails because Docker prevents its namespace
sandbox from starting (`Operation not permitted`). No host Chrome protection or
product launch flag was changed. After explicit user approval, all four lifecycle
tests passed on Node 24.22.3 with a test-only `--no-sandbox` wrapper in a separate
unprivileged container: no external network, read-only root/package, no added
capabilities and no host home mounted. They cover screenshot/progress, cancel,
disconnect and server shutdown; the container was removed afterward. This does
not claim the default Chromium sandbox works inside Docker, nor does it measure
the design quality of a real interface.

## OpenAI: actual Codex host, personal account

Installed the portable OpenAI ZIP in Codex CLI 0.160.0 through a local-only
marketplace, with disposable HOME/CODEX_HOME and file-backed authentication.
Verified the personal account and Plus plan before executing any model test.
The default business login was rejected and logged out of the temporary profile;
no model test was run with it.

- Native host discovery returns 29 enabled `ui-craft:*` skills and no skill errors.
  Five additional system skills are bundled by Codex itself, not extra UI Craft entries.
- Real calls on the final rebuilt package: `score_ui` returns 100/A for the
  intentionally trivial `<button>Save</button>` transport fixture; `route_task`
  returns `/craft dashboard` for the analytics/KPI prompt. This does not evaluate
  the quality of an actual interface.
- Explicit typed skill attachment `ui-craft:polish` loads through the native
  app-server input API with shell disabled. It correctly identifies
  `references/review.md`, “Polish Pass (Compound Details)”, without tool calls.
- A bare `$polish` attempt with all file tools disabled could not read the skill
  and stopped, as requested. The host's qualified name is `ui-craft:polish`.
- Shell, unified execution, web, connected apps and remote plugins were disabled
  for the model trials; the tool-only trial made only its two requested MCP calls.

This verifies the Codex host and portable package, not ChatGPT desktop's UI,
visual icon rendering, public-directory eligibility, or OpenAI's local-MCP
partner allowlisting. Those are separate checks and have not been claimed.

## Cursor

The macOS CLI OAuth flow reached authorization but could not save its global
native keychain item. No existing keychain entry was deleted or repaired.
Changing HOME is not sufficient to isolate this native credential store.
An app copy allowed distinguishing the temporary GUI from the user's original;
its safe-storage errors prevented a successful authenticated GUI trial.

A Cursor CLI installed from the official vendor source in the disposable Linux
container uses a separate home/store. Its personal identity was verified, and
the account reported no team memberships. The unchanged Cursor package was
installed under the documented local-plugin discovery directory in that profile.

The actual host discovered `plugin-ui-craft-ui-craft-mcp`. In noninteractive mode,
approving server startup alone still rejected calls; a project-local allowlist
for exactly `score_ui` and `route_task` enabled both requested calls. Shell, writes
and web fetch were denied, with Ask mode retained and no `--force`/`--yolo`.
The calls returned the same measured fixture score and workflow route as OpenAI.
No third-party connector operation or design workflow was executed.

The legacy `agent mcp list` command did not report plugin-bundled servers, even
though real native tool discovery and execution succeeded. It is not sufficient
evidence that an installed plugin has no MCP server. The successful trial is of
Cursor CLI on Linux; an authenticated macOS editor GUI trial remains unverified.

## Windows

Not executed. UTM 5.0.9 was installed from the official release after validating
its SHA256, deep code signature and Gatekeeper notarization. Its empty welcome
screen was observed. No Windows guest, VM disk, shared home directory or license
purchase was created. Installing a virtualizer does not validate the Job Object
implementation; that still needs a real Windows run.

## Preservation and boundaries

Protected-source checks retain 109 original source/config/candidate hashes.
Default Codex configuration, Cursor MCP configuration and personal marketplace
file hashes also remain unchanged. Temporary plugin installs are not updates to
the user's existing installation. No personal credential, token, login URL or
account identifier belongs in this report.

## Local lifecycle correction after host trials — 2026-11-27

Progress sends now stop being awaited when the owned AbortSignal fires, including
the hard deadline, client cancellation and server shutdown. Late send rejections
remain handled. Shutdown returns exit code 1 if cleanup failed, even when the
failed job already left the active set.

Nine new automatic regressions cover four blocked-progress phases, two deadline
cases and shutdown with successful, active-failed and previously-failed cleanup.
The complete local macOS suite passes 41 tests, with one native-Windows test
skipped, on Node 26.13.0. All six extracted-package tests pass for the rebuilt
archives. No browser or authenticated client trial was repeated.
Rebuilt archive hashes and extracted-package results are recorded separately
under `lifecycleFix` in `VALIDATION-RESULTS.json`.
