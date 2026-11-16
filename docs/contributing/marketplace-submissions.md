# Marketplace submissions

Checked against official documentation on 2026-11-16. A local validation result
does not establish directory approval or successful installation.

## Claude

- Submit the public repository root at <https://claude.ai/directory/manage>.
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
