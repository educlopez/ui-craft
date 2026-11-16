# Marketplace submissions

Checked against official documentation on 2026-11-16. A local validation result
does not establish directory approval or successful installation.

## Claude

- The full plugin remains at the repository root for direct Claude Code installs.
  Its directory submission was refused by policy on 2026-11-16: local MCP and
  command hooks require a Verified organization; the repository root also exceeds
  the Community file/config allowlists. A paid personal plan is not that badge.
- The separate skills-only edition is `plugins/claude-directory/`. It has 29
  skills under the distinct plugin name `ui-craft-skills`, Markdown references,
  a PNG icon, license and edition-specific privacy
  notice; no MCP, hooks, executable files, package-manager config or review agents.
  Enable only one edition per session to avoid duplicate guidance.
- Build with `python3 scripts/package-claude-directory.py`; check freshness with
  `python3 scripts/package-claude-directory.py --check`. The builder only reads
  allowlisted tracked mirror/example files; personal untracked skills are excluded.
  It adapts automated routing, detector, scoring and fold checks to honest manual
  workflows. Do not edit generated files: update the builder or canonical sources,
  regenerate, and review the output diff. Canonical source edits still affect the
  full edition; edition-only adaptations belong in the builder.
- `python3 scripts/package_claude_directory_test.py` runs nine regression tests,
  also part of `nr verify`. The builder enforces scanner file/size limits,
  known manifest fields, no executable config, unique skill identities and internal
  links, and refuses symlink outputs or unexpected files rather than deleting them.
- The ZIP is `dist/ui-craft-claude-skills.zip` (plugin files at archive root).
  It is a local handoff artifact, not an uploaded or approved directory listing.
- After explicit commit/push authorization, submit the repository with plugin
  path `plugins/claude-directory`, not the repository root. The existing root
  submission cannot change its plugin path; a new submission is needed. Keep its
  source on main and do not withdraw the full-plugin candidacy without approval.
- Use `.claude-plugin/icon.png` inside the skills edition for a separate portal
  icon upload if requested (1024 x 1024 PNG). It is rendered from the existing
  brand SVG, not a redesign. The root candidacy already recognized assets/icon.svg;
  its letter placeholder was a preview limitation, not a missing icon.
- Set privacy/docs/support/license links explicitly in the listing if the portal
  does not infer them from the package README. Do not add unsupported runtime
  fields to the manifest or make legal attestations for the publisher.
- `claude plugin validate plugins/claude-directory` passed locally on 2026-11-16.
  This does not run the directory's safety scan or policy review; approval is
  **not verified**. Install-line advice remains until an actual listing exists.
- Use Eduardo's personal paid account. The first submitting organization owns
  the listing; do not submit this personal project from an employer's account.
- Run `claude plugin validate .` and the portal's Validate step before submission.
- The omitted manifest version is deliberate: the existing distribution contract
  tracks commits instead of freezing installations on an unchanged version.
- `hooks/hooks.json` uses Claude's PostToolUse format; Cursor's separate hook
  lives in `hooks/cursor.json`.
- Local `.DS_Store` files are ignored by Git and must not enter an uploaded archive.
- The portal rejects `.npmrc` values beginning with `@` or containing wildcards.
  The repository has no `@educlopez/` dependencies that need a scoped exemption.
  `min-release-age=2` sets a two-day cooldown on npm versions supporting that
  option; `minimum-release-age=2880` is a separate, legacy pnpm-style setting,
  not an npm setting. Do not assume it is enforced by pnpm 9 in CI or modern
  pnpm versions that require settings in `pnpm-workspace.yaml`.

Guide: <https://claude.com/docs/directory/publish>.

## Cursor

- Publisher application submitted on 2026-11-16. The portal displayed
  "Thanks for applying" and "We've received your submission". Marketplace
  approval and a public listing are still pending.
- Submit <https://github.com/educlopez/ui-craft> at
  <https://cursor.com/marketplace/publish>.
- Manifest: `.cursor-plugin/plugin.json`.
- Run `node scripts/cursor-plugin.mjs validate` and
  `node --test scripts/cursor-plugin.test.mjs`.
- Publisher account, contact details and acceptance of Publisher Terms belong in
  the portal, not this repository. Submission is not marketplace acceptance.

Guide: <https://cursor.com/docs/plugins>.

## OpenAI / Codex

- Draft manifest: `.codex-plugin/plugin.json` (supported compatibility format).
- Run `python3 scripts/package-openai-plugin.py` to build
  `dist/ui-craft-openai.zip` from allowlisted files. This never publishes anything.
- The archive materializes the Codex mirror once under `skills/`, not alongside
  the canonical skill tree. Duplicate skill names and unresolved bundled skill
  links fail the build. A package-specific README describes this installation.
- `python3 scripts/package_openai_plugin_test.py` exercises the archive and its
  failure cases; the `openai-package` suite in `nr verify` runs it in CI too.
- This draft preserves the local MCP, Node.js prerequisite and focused skill
  mirrors. It is not a skills-only substitute for the full product.
- Local MCP submissions require an approved partner organization and allowlisting.
- Verify eligibility, developer identity, package scans, clean installation,
  public privacy/terms requirements and review details before submission.
- No privacy policy or legal attestations are fabricated by the build script.
- Do not silently remove the MCP to bypass eligibility: adding an MCP to an
  existing skills-only listing is currently unsupported.

Guides: <https://developers.openai.com/plugins/deploy/submission> and
<https://developers.openai.com/plugins/deploy/desktop-only>.

## MCP Registry

Separate from all client directories. npm ownership metadata (`mcpName`) must be
published before registering a package-backed server with `server.json` and
`mcp-publisher`. The currently published npm artifact must be checked before
choosing a version; a local edit cannot retrofit npm ownership metadata.

Guide: <https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx>.

The descriptor is `mcp/server.json`; its ownership marker and versions are
checked against `mcp/package.json` by the MCP tests. After the matching npm
artifact is published, authenticate with `mcp-publisher login github` and run
`mcp-publisher publish mcp/server.json` from the repository root. Verify the
registry's public API before claiming the listing is live.

The publisher writes `.mcpregistry_*_token` files into its working directory.
They are credentials, not registry metadata: never commit or copy their
contents. They are ignored here; log out after a one-off publication.
