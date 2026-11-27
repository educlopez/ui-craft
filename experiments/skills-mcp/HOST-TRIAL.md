# Interactive Claude Code trial — 2026-11-26

## Environment and isolation

- Installed Claude Code: 2.1.332. The UI reported Opus 5.5 and Claude Pro.
- A separate temporary `CLAUDE_CONFIG_DIR` was authenticated with the user's
  personal Pro account. The existing default login was confirmed as the work
  Team account both before and after the trial; it was not switched.
- Empty scratch workspace, outside this checkout. It remained empty after all
  trials. Neither the current repository nor personal plugins were loaded.
- CLI flags: `--setting-sources project,local --strict-mcp-config`, explicit
  temporary `--mcp-config` and `--settings`, `--ax-screen-reader`, `--no-chrome`.
  Settings disabled hooks, auto-memory and claude.ai connectors. Bash, Write,
  Edit, Agent, Task, WebFetch and WebSearch were explicitly disallowed.
- Claude initially defaulted to auto permissions. The final loading trial used
  `--permission-mode default` (the UI reported manual mode).
- A subsequent launch auto-enabled Claude's built-in Easel plugin despite
  strict MCP configuration. No Easel tools were called. For the final trial,
  built-in plugins were explicitly disabled in temporary settings; `/mcp`
  showed only the prototype connected, plus computer-use marked off.
- No `claude mcp add`, personal settings edits, plugin installation commands,
  repository skill installation, candidate submission, commit or publishing.
  The test server was passed directly through the temporary MCP config.

## Observed results

1. **Discovery:** `/mcp` reported connected, protocol `2026-07-28`, dynamically
   configured, **8 tools, 64 resources and 64 skills**. View skills listed the
   expected `ui-craft-prototype:<name>` entries.
2. **Direct skill load:** invoked
   `/ui-craft-prototype:ui-craft-ref-typography` with a read-only task. The host
   inserted the generated skill body into the session (including the prototype
   delivery rules). Claude returned three specific rules, verified against the
   canonical typography reference: a four-to-six-step scale, lighter display
   weights, and `font-synthesis: none` for missing weights/styles.
3. **Tool execution:** Claude used ToolSearch and then the actual
   `mcp__ui-craft-prototype__score_ui` tool with
   `{"code":"<button>Save</button>"}`. Result: score 100, grade A, no findings.
   This validates execution, not a general accessibility endorsement of HTML.
4. **Workflow and linked reference:** invoked `/ui-craft-prototype:polish` with
   a read-only override. Claude called the host `Skill` loader for
   `ui-craft-prototype:ui-craft-ref-review` and returned checks actually present
   in the Polish Pass section. No files were read or edited.
5. **Opt-out:** a fresh session with `UI_CRAFT_MCP_SKILLS=0` reported protocol
   `2026-07-28` and **8 tools only**, with no View skills action.
6. **Manual approval:** repeated the workflow in manual permission mode. The
   host displayed the reference description, version digest and choices Allow
   once / Allow this version / Deny. Selected **Allow once**, not the persistent
   option. The skill loaded and Claude returned a correct heading-spacing rule.

## Recovered failure and remaining work

Historical initial result: the addressing failure below is resolved in the
same-day retest documented at the end of this note.

In the manual trial, Claude first passed
`ui-craft-prototype:skill://ui-craft-ref-review/SKILL.md` to the Skill tool. The
host rejected it and explicitly suggested
`ui-craft-prototype:ui-craft-ref-review`. Claude retried with that name, asked
for approval and completed successfully.

Resource URIs work for transport and integrity, but they are not host invocation
names. Before promotion, improve the generated delivery guidance to explain
that distinction without assuming a fixed server registration name, and repeat
this workflow in a fresh session. No code change was made to hide the failure.

This was a targeted host trial, not all 64 skills end-to-end. Denial, persistent
allow, changed-version reapproval, automatic skill selection quality,
`check_fold` browser execution, Claude web/Desktop, hosted connectors and
Codex/Cursor remain unverified. This says nothing about Directory approval.

## Cleanup and preserved state

All three interactive Claude sessions were exited. Raw transcripts were
inspected locally for the actual tool calls; they are not copied into this
repository. The temporary login/configuration is removed after the trial.
Existing tracked server/candidate/configuration files remain unchanged; only
this experimental documentation is updated. No commit, PR or publication.

## Same-day retest after invocation guidance fix

The experimental generator now explains three distinct values: catalog name,
MCP resource URI and host invocation name. Each generated entry includes a
dependency name-to-resource table and instructs the model to use the exact
host-advertised name on the current server. The prefix is never hard-coded.
Resource URIs are retained for transport and integrity; passing them as Skill
arguments is explicitly prohibited. Four regression tests were added.

A fresh temporary profile was authenticated with the personal Pro account.
The MCP registration was deliberately renamed from `ui-craft-prototype` to
`design-lab`, to check that the fix did not depend on the original prefix.
Claude Code 2.1.332, manual permissions, hooks/memory/connectors/built-in plugins
disabled in temporary settings, disallowed filesystem writes/commands/browser
tools/agents, empty scratch workspace. `/mcp` showed only `design-lab` connected,
protocol `2026-07-28`, 8 tools, 64 resources, 64 skills.

`/design-lab:polish` was asked to load the linked review reference read-only,
without being told its invocation name. The **first** Skill call was
`design-lab:ui-craft-ref-review`. Claude displayed a digest-bound approval
dialog; Allow once was selected. It loaded successfully and quoted the actual
heading-spacing Polish Pass check. There was no URI-as-name error or retry.

`/design-lab:typeset` then loaded `design-lab:ui-craft-ref-typography` on its
first Skill call, also with Allow once, and quoted the reference's 2.5–4x
display-step separation rule. The local transcript was checked programmatically:
exactly those two Skill tool calls, zero tool errors, and both revised delivery
guides injected. The scratch workspace stayed empty. This verifies two targeted
dependency loads, not every possible model choice or all 64 skills.

The automated suite passes 15 tests; the original server's four smoke tests
also pass. The generated catalog remains 64 entries; the largest is now 46,311
bytes, below the enforced 100 KB per-file/skill budget.

Retest cleanup: the interactive session exited, the temporary personal login
was logged out and verified absent, and its configuration/transcripts/workspace
were deleted. No prototype server child process remained. The default work
login and all tracked candidate/server/installation files remained unchanged.

## Metadata and cancellation increment — automated validation

Implemented in the experiment only: server title/description/website, embedded
PNG/SVG icon metadata, conservative per-tool annotations, requested progress
notifications and cancellable owned worker process groups. The bundled canonical
tool implementations and existing installation/candidate files remain untouched.

Validation passed:
- 21 regular tests: legacy/modern schemas and payloads, metadata fields, skill
  delivery, monotonic/quiet progress, cancellation, hard limits, TERM-resistant
  descendants, temporary-profile cleanup and worker/render concurrency limits.
- Four serial integration tests using actual Chrome on disposable loopback
  fixtures: screenshot success, cancel, disconnect and SIGTERM during rendering.
  Worker groups and profiles were cleaned in every case. No owned Chrome remained.
- Four smoke tests of the original installed server, without reinstalling it.

Historical status before the user authorized OAuth (now resolved; see the
validated follow-up below): the interactive Claude retest was **pending**, not verified.
Its separate personal-account OAuth page repeatedly returned "Demasiado pronto.
Espera y vuelve a pulsar." The existing default account/configuration was not
switched. The disposable fixture HTTP server was stopped while authorization is
pending. Only the temporary login flow remains available to continue.

The terminal does not establish visual icon rendering. Automated checks verify
icon metadata/bytes and host acceptance must be distinguished from whether a
particular client actually paints the logo.

## Metadata and cancellation increment — Claude personal trial passed

The user completed authorization, and the isolated CLI login was verified as
personal Claude Pro. Claude Code 2.1.332 ran interactively in the existing empty
scratch workspace, with manual permissions, only the temporary `design-lab` MCP
configuration, and hooks/memory/connectors/built-in plugins disabled. No personal
installation or candidate was registered or changed.

- **Metadata accepted:** `/mcp` showed connected, revision `2026-07-28`, 8 tools,
  64 resources and 64 skills. Claude's connection diagnostic contained title
  `UI Craft — local prototype`, the correct website and two icon entries. PNG
  (120,201 bytes) and SVG (24,971 bytes) decoded exactly to the bundled assets.
  This proves receipt/acceptance, not graphical icon rendering in a terminal.
- **Normal render:** approved one `check_fold` call on a disposable loopback
  fixture. Claude displayed `Starting isolated check`, `Rendering page in an
  isolated browser worker` and `Check completed`. The actual tool result included
  an image and measurements. The intentionally unstyled fixture failed one
  design check (`ok:false`); functional success is not a design-quality pass.
- **Real cancellation:** approved `check_fold` on a deliberately unfinished
  loopback response. Before interruption, confirmed that the fixture received
  `/slow`, a job profile existed and the owned Chrome was running. Claude showed
  elapsed-time progress. Pressed Escape, and Claude reported the call interrupted
  with no result. At the first post-interruption check the job directory was
  empty, the worker/Chrome PIDs had exited, and no owned browser remained.
- **Recovery:** in the same session, called `score_ui` on
  `<button>Save</button>` after cancellation. It completed and returned 100/A.
  No retry of the cancelled render was made.

The transcript was checked for actual tool calls: ToolSearch, two `check_fold`
calls and one `score_ui` call only. No filesystem tools, commands or agents were
called by the tested Claude session; the workspace stayed empty. All permission
prompts used the one-call Yes option, never a permanent allow rule.

The interactive CLI and local fixture server were stopped after verification.
The isolated login was logged out and the temporary profile/transcripts removed.
The earlier 21 regular tests, four real-browser lifecycle tests and four original
server smoke tests remain the automated baseline; this turn changed documentation
only. No publication, commit, candidate edit or installation change.
