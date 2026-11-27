# UI Craft plugin privacy notice

Effective date: 2026-11-27

This notice describes the UI Craft skills, declared local detector hook, and
local MCP server distributed from this repository. It does not describe the
separate privacy practices of the agent application or any third-party service.

## Local processing

UI Craft's local quality tools process source code and project files supplied
by the user or their agent. They return findings to that agent application.
The plugin does not require a UI Craft account or a hosted UI Craft backend.
These local tools do not intentionally collect personal records or credentials.
Files users choose to analyze can nevertheless contain personal or confidential
information; avoid including information that the agent should not access.

The bundled skills are instructions executed by the user's agent. Depending on
the requested workflow, the agent can read and edit project files, run local
tools, and use browsing or integrations available in that application. Its
permissions and the user's instructions still apply.

## Storage and retention

UI Craft does not operate a service that retains code or conversation data
received through these local tools. Inline-code scanning can create temporary
local files and attempts to delete them after scanning, including on handled
errors. A process crash or interrupted cleanup can leave a temporary file.

Workflows can create design briefs, specifications, findings, and project
context in the user's workspace, including `.ui-craft/`. These local artifacts
remain until the user or their tools modify or delete them. The agent
application may separately retain conversations, tool results, or logs under
its own settings and policies.

## Network access and third parties

Installing the local MCP server through the declared `npx` launcher contacts
the npm registry to obtain the pinned package and its dependencies. The local
quality tools are not a hosted data-collection service. UI Craft does not add
an analytics or advertising collection endpoint to those tools.

Self-contained desktop ZIP editions bundle the MCP server and its dependencies,
so their declared Node launcher does not contact npm at first use.
The check_fold tool launches an installed Chrome-family browser with a temporary
profile and navigates to the user-supplied URL. That destination and its
subresources receive normal browser requests. Worker profiles are removed after
verified process cleanup; a cleanup failure retains them for inspection.

If a workflow uses browsing, remote references, or an optional integration,
that interaction is performed by the user's configured agent or tools. The
relevant provider's privacy policy applies. This notice does not promise that
the agent application or its external tools keep all activity on the device.

## Support and contact

For privacy questions, use the repository's
[support page](https://github.com/educlopez/ui-craft/issues). GitHub issues are
public: do not include credentials, personal data, private source code, or
conversation transcripts. Contact information supplied privately to a
marketplace for review is handled through that marketplace, not through the
local plugin.

UI Craft is maintained by [Eduardo Calvo](https://github.com/educlopez).
Its use is governed by the [MIT license](LICENSE), including its warranty and
liability terms. Changes to this notice are recorded in the repository history.
