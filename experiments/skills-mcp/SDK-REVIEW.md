# SDK v2 opportunities for ui-craft — 2026-11-26

Read-only review of the installed experimental `@modelcontextprotocol/server`
2.4.0 types and official documentation. These are proposals, not implemented
features or verified host support. Some APIs also existed in v1: they are useful
capabilities of the SDK, not all newly introduced features.

Follow-up: the user subsequently authorized metadata/icons and progress/cancel
implementation in the local prototype only. Those are now implemented and pass
the automated lifecycle suites and a targeted personal-account Claude Code trial,
including progress, Escape cancellation and recovery. Other items below remain proposals. See README.md and
HOST-TRIAL.md for the current validation status.

## Recommended next steps

### 1. Proportionate tool metadata and branding — low cost

The SDK supports behavioral annotations and icon metadata. Assess the pure tools
individually for read-only/non-destructive hints; don't label every tool safe by
default. Add server title, website and an appropriate version of the existing
`assets/icon.svg` through the SDK's icon fields, without changing any Directory
submission. Prefer embedded assets to avoid tracking fetches; test a PNG fallback
where SVG rendering is unavailable. These hints are not an authorization boundary
and don't guarantee a client displays an icon.

Sources: [tool metadata](https://ts.sdk.modelcontextprotocol.io/v2/servers/tools.html#annotate-the-tool),
[server metadata API](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/server/mcp),
[official icon example](https://github.com/modelcontextprotocol/servers/blob/main/src/everything/docs/features.md#icons).

### 2. Progress and cooperative cancellation — highest operational value

Use request context progress notifications for lengthy scans and renders, and
propagate `ctx.mcpReq.signal` into their work. The existing `checkFold` signature
accepts no request signal and calls `measureFold(url, { width, height })`.
An SDK swap alone won't cancel the browser. A future change needs signal plumbing,
hard deadlines and browser cleanup in `finally`, tested on stop/disconnect and
failure. Keep progress quiet when the client supplied no progress token. Use
stderr for stdio diagnostics, never stdout.

Source: [progress, cancellation and diagnostics](https://ts.sdk.modelcontextprotocol.io/v2/servers/logging-progress-cancellation.html).

### 3. Versioned catalog caching and development reload — medium cost

`loadSkills` supplies digest verification; `reload()` can rescan catalog changes.
For local development, an explicit reload path could shorten iteration. Published
catalogs should remain release-pinned; never treat reload as approval of changed
content. `memorySkillFiles` also enables immutable embedded catalogs or runtimes
without a filesystem. None requires changing canonical skills or candidate files.

Modern cache hints can reduce repeated discovery/resource requests. Public scope
is appropriate only for identical public catalog content; never use it for user
code or private reports. Shared client caches need principal partitioning. Tools
execution itself is not covered by these discovery/resource-cache settings.

Sources: [catalog APIs](https://ts.sdk.modelcontextprotocol.io/v2/servers/skills.html),
[response cache](https://ts.sdk.modelcontextprotocol.io/v2/clients/caching.html).

### 4. Separate remote connector — strategic, higher cost

`createMcpHandler` can serve a factory over Streamable HTTP. That enables a
separately hosted catalog rather than requiring a local npm subprocess, but
doesn't grant marketplace eligibility. Start a future design with public skills
and truly pure inline-input tools, not the existing local file/browser APIs.
Require input limits, privacy/retention decisions and abuse protection. Any
browser-render service needs SSRF protection and network isolation. Authentication
and Host/Origin validation must be composed explicitly; the bare handler does not
provide them. Deployment needs a separate authorization and operating-cost decision.

Source: [HTTP serving and security boundaries](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html).

## Useful later, not the first increment

- **Guided interactions:** `input_required` and form elicitation could ask for
  missing target, surface or mode before a deterministic tool runs. Use only
  negotiated client capabilities; handle decline/cancel and legacy behavior.
  It does not replace host skill or tool permissions. For plain workflow
  conversations, existing skill questions may already be enough.
  [Official API](https://ts.sdk.modelcontextprotocol.io/v2/servers/input-required.html).
- **Large reports:** `resource_link` can defer report bytes until requested.
  Keep the existing screenshot image block in `check_fold` by default: inspecting
  the image is part of that tool's contract. Access control, expiry and host
  resource rendering must be tested before adding optional linked artifacts.
  [Content types](https://ts.sdk.modelcontextprotocol.io/v2/servers/tools.html#return-other-content-types).
- **Explicit prompt entry points:** `registerPrompt` can expose user-triggered
  templates to clients, but do not duplicate all 29 skills or use prompts to
  bypass skill approval. Consider only when a target host has a measured need.
  [Prompts](https://ts.sdk.modelcontextprotocol.io/v2/servers/prompts.html).
- **Long-running tasks:** tasks are a separate extension, not something that
  silently appears after upgrading the core SDK. The official TypeScript
  extension documents requester and legacy receiver support; a production task
  server needs a separately verified implementation, storage and host matrix.
  Prefer progress/cancellation first.
  [Tasks extension](https://modelcontextprotocol.github.io/ext-tasks/typescript/).

Avoid building new reliance on deprecated sampling, roots or protocol logging.
The SDK documents them as sunset features; prefer elicitation, explicit inputs
and local diagnostics/optional observability as appropriate. No telemetry or
external service was enabled as part of this review.
