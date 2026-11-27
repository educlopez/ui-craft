# Local Skills over MCP prototype

Isolated, private experiment. Nothing here changes the released MCP server,
installation pins, installed skills, or the Claude Directory candidate. Do not
publish this package or register it in a personal MCP configuration automatically.

The next-version preparation is now available separately: see
[RELEASE-PREPARATION.md](RELEASE-PREPARATION.md). Its artifacts are staged under
the repository's `dist/marketplace-v2/`; existing manifests and the Claude
skills-only candidate are not rewritten. Native Windows/Linux validation is
still a release gate, not an asserted result.

## Build and test

From this directory:

```sh
ni --frozen-lockfile --ignore-scripts
nr build
nr test
```

The local lockfile uses pnpm. Node 20 or newer is required. Dependencies are
installed only in this directory; the SDKs are pinned to 2.4.0 (server/client)
and 1.32.2 (legacy compatibility tests). Existing `mcp/node_modules` is not used
or repaired by this experiment.

The regular suite includes worker lifecycle fixtures but does not launch Chrome.
For the separate, serial real-browser integration suite, first check existing
headless processes/capacity, then run `nr test:browser`. It starts one disposable
Chrome at a time and tests render success, cancel, disconnect and server shutdown.

## Opt-in launch

Tools only, no skills capability advertised (the default):

```sh
node /Users/eduardocalvolopez/Developer/Personal/ui-craft/experiments/skills-mcp/dist/server.mjs
```

Tools and Skills over MCP:

```sh
UI_CRAFT_MCP_SKILLS=1 node /Users/eduardocalvolopez/Developer/Personal/ui-craft/experiments/skills-mcp/dist/server.mjs
```

These are stdio server commands for a test client, not interactive commands that
print a result and exit. No running server or client registration is left by the
tests. To opt out, unset the variable or set it to `0`. Other values fail startup.
Do not enable these skills alongside the existing full plugin or skills edition:
duplicate guidance is not resolved automatically. No active host configuration
has been modified; an interactive host trial still needs explicit setup.

## Architecture and boundaries

- `build.mjs` reads the existing server and generates a factory around its tool
  registrations at build time. Layout checks fail if that source changes shape.
  It does not rewrite the original file or copy tool implementations by hand.
- `adapter.mjs` wraps raw Zod shapes as v2 schemas. The official `serveStdio`
  entry serves both the 2025 legacy handshake and the 2026-07-28 discovery flow.
  Merely swapping the old transport imports would remain legacy-only.
- Server and tool metadata include the existing UI Craft icon as embedded PNG
  and SVG, a human-readable title and website. Read-only hints apply to the seven
  local/static checks; `check_fold` is explicitly open-world and not labeled
  read-only/idempotent. Annotations are client hints, never authorization.
- `tool-runner.mjs` runs each call in an owned process tree using the
  same bundled factory and unchanged canonical tool handlers. It invokes the
  SDK with a private legacy client; public clients still negotiate either era.
  The internal `UI_CRAFT_MCP_TOOL_WORKER` marker prevents recursive spawning and
  is not a user setting. Client credentials/API keys are not forwarded.
- A requested progress token gets monotonic start/running/elapsed/completion
  notifications, without inventing a percentage or total. Quiet clients receive
  none. Cancel, disconnect, SIGTERM/SIGINT and hard deadlines terminate the whole
  owned group, escalating to SIGKILL; temporary browser profiles are removed only
  after the group exits. Every worker has an independent watchdog as a safety net.
- At most two checks and one render run per prototype server. Busy calls return
  an error instead of silently queuing. Hard limits are 30 seconds per ordinary
  check and 60 seconds per render. This guarantees cancellation without editing
  the existing analyzers, at the cost of a process/SDK startup per call. POSIX
  on macOS/Linux. Windows uses a bundled Job Object guard with atomic worker
  assignment and verified job draining; it is implemented but not yet verified
  on a native Windows machine. Restricted Windows policies fail closed.
- `catalog.mjs` derives a separate catalog from canonical `skills/`, `commands/`
  and the linked animation storyboard example. It never reads or writes
  `plugins/claude-directory` or runs its packaging script.
- The generated catalog has 29 base/workflow skills plus 35 separately loaded
  reference skills. References are split into their own skills, not truncated or
  copied into every workflow. Currently all 64 entries fit under 100 KB each.
  The build enforces that budget; this is stricter than the 400 KB per-skill cap
  because every generated skill contains exactly one text file.
- Local Markdown links and bare reference paths become catalog skill URIs.
  Cross-skill links require the host's normal approval and loader; they do not
  grant automatic consent. Runtime files resolve relative to the bundle, not
  the client's working directory. Catalog content contains no executables or hooks;
  the separate server runtime includes its Windows ownership helper.
- Each entry explicitly separates catalog names, resource URIs and host skill
  invocation names. A generated dependency table maps names to resource URIs;
  the host's actual server namespace supplies the invocation prefix. Never pass
  a URI to the host Skill tool. No registration name is hard-coded.
- Every generated entry starts with delivery rules explaining host permissions,
  unavailable local paths, workflow arguments and optional capabilities. It
  does not promise that slash commands or review agents were installed.
- The SDK loads the catalog in strict mode and serves digest-checked resources.
  Missing/invalid catalogs fail startup when opted in; they are not silently
  omitted. When opted out, no catalog is read at runtime.
- `dist/baseline/server.mjs` is a test-only v1 bundle. Neither artifact reads the
  checkout's sources at runtime. `dist/` and dependencies are ignored by Git.

## Compatibility differences made explicit

The tool names, arguments, tool payloads and error results are compared against
the v1 baseline. These intentional schema/protocol differences are asserted:

1. v2 no longer advertises legacy `execution.taskSupport: forbidden`.
2. The JSON Schema dialect changes; comparisons ignore only `$schema` markers.
3. The legacy scanner finding schema disallows metadata actually returned by
   `tokens_lint`. A regression test reproduces rejection by the v1 client. The
   experimental adapter allows extra finding fields without dropping payload
   data. No fix is applied to the released server.
4. Modern tool responses carry SDK server-identity metadata. Tests assert its
   exact expected value before comparing the unchanged tool payload.
5. Icon/annotation metadata and server branding are added deliberately. Tests
   check these fields independently before comparing all original tool schemas.

## Tests and remaining limits

Tests cover v1 and v2 clients, opt-in on/off, modern protocol negotiation and
legacy fallback, all eight advertised tool schemas, seven non-browser tool
calls, error results, full catalog discovery/get/read, digest verification,
internal URI resolution, size budgets, relocation away from the checkout,
unknown/traversal resource rejection, tampering, strict symlink rejection and
fail-closed startup. Test clients and temporary directories are closed/removed.

The optional real-browser suite verifies `check_fold` execution, screenshot
delivery, progress and cleanup. It does not evaluate design quality or public
websites. An interactive Claude Code trial on a
personal Pro account verified discovery, skill loading, a tool call, nested
reference approval and opt-out; see [HOST-TRIAL.md](HOST-TRIAL.md) for evidence
and the same-day fix/retest of a skill-addressing failure. Codex/Cursor, marketplace eligibility
and hosted-connector support remain unverified. A `claude -p` run is not a
substitute for an interactive host trial.

This is not a release-ready catalog: separate reference skills increase the
discovery surface, and the generated workflows retain canonical examples and
optional capabilities under the delivery rules. Host behavior, activation
quality and permission UX need evaluation before promoting or changing pins.

Additional SDK opportunities are evaluated, not implemented, in
[SDK-REVIEW.md](SDK-REVIEW.md).

SDK references: [Skills API](https://ts.sdk.modelcontextprotocol.io/v2/servers/skills.html),
[v2 migration](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2),
[Claude host support](https://code.claude.com/docs/en/mcp#use-skills-from-mcp-servers).
The attachment API is experimental; keep the SDK version pinned during trials.
