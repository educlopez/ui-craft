---
name: start
description: Orient the user in the UI Craft skills edition, inspect available project context, and recommend one focused next step without changing files.
---

**Claude Directory skills edition.** This package provides instructions only:
no bundled MCP server, command hook, executable helper, or review agent. Do not
install or launch UI Craft tools on its behalf. Use the supplied references for
manual reviews. Never invent detector results, a deterministic UICraftScore,
seeded draws, or browser measurements. State what was actually inspected and
mark unavailable checks as not verified. Use only capabilities already available
and authorized in the current session; otherwise request source or screenshots.
Write project files only with available, authorized tools; otherwise return the
proposed content as text and do not claim it was saved.
References named below live in the ui-craft skill's references/ directory.


# Start

Read the ui-craft skill. This skill only inspects and routes; do not build or edit.
Identify the framework, existing tokens, brief/spec, target surface and current
host capabilities from supplied context or authorized read tools. Ask for missing
source or screenshots instead of assuming filesystem or browser access.

Report the four rungs honestly:
- Ask: design guidance through the main skill.
- Direct: focused skills such as craft, critique, audit, polish and animate.
- Persist: brief, tokens and remember, only if authorized writing is available.
- Review: manual finalize checklist; no automated gates or deterministic score.

Recommend exactly one next step: brief if context is missing; tokens if the token
spine is absent; craft/sddesign for a new surface; critique/audit for an existing
one; finalize before shipping. Wait for the user before executing that step.
