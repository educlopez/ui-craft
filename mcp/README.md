# ui-craft MCP Server

Deterministic design-quality gate exposed as a stdio MCP server. Complements the `ui-craft` skill (taste/judgment layer) — never duplicates it.

## Install

```bash
npm install -g ui-craft-mcp
# or use npx (no install required):
npx ui-craft-mcp
```

## Wiring

Copy `.mcp.json.example` from the repo root to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "ui-craft": {
      "command": "npx",
      "args": ["ui-craft-mcp"]
    }
  }
}
```

Claude Desktop, Cursor, and other MCP clients read `.mcp.json` automatically.

## Tools

### `check_anti_slop`

Scans source code for anti-slop violations using the 37 deterministic rules from `ui-craft-detect`. In-process (no subprocess spawn).

**Input** (one required):
- `code` — inline source string
- `path` — file or directory path

**Output**:
```json
{
  "findings": [{ "severity": "error|warning", "rule": "...", "file": "...", "line": 42, "message": "..." }],
  "summary": { "total": 3, "errors": 2, "warnings": 1 }
}
```

### `tokens_lint`

Static regex analysis for off-system token values. Flags: raw hex colors, non-scale `border-radius` px, non-8pt spacing px, and magic `z-index` integers. Token scale source: `references/tokens.md`.

Rule IDs: `tokens/color`, `tokens/radius`, `tokens/spacing`, `tokens/z-index`.

**Input** (one required): `code` or `path`

**Output**: same `findings[]` + `summary` shape as `check_anti_slop`.

### `acceptance_bar`

Returns the deterministic acceptance checklist for a UI surface. Data only — no scoring or judgment. Scoring is the caller's responsibility using `check_anti_slop` + `tokens_lint` results.

**Input**:
- `surface` — one of: `dashboard`, `landing`, `auth`, `generic`

**Output**:
```json
{
  "surface": "dashboard",
  "items": [{ "id": "dash-01", "description": "...", "category": "hierarchy" }]
}
```

**Surfaces**:
- `dashboard` — SaaS dashboard acceptance bar (from `recipe-dashboard.md`)
- `landing` — Landing page acceptance bar (from `recipe-landing.md`)
- `auth` — Auth screen acceptance bar (from `recipe-auth.md`)
- `generic` — 10 finish-bar passes (from `finish-bar.md`)

## Boundary: Taste vs. Deterministic

> The MCP server is the **checks layer**. The SKILL.md is the **taste layer**.

This server contains ZERO taste, judgment, or aesthetic preference rules. All such rules live exclusively in `skills/ui-craft/SKILL.md`. The server produces identical output for identical input — it is a deterministic gate, not an AI evaluator.

## acceptance-data — Regen on Recipe Edit

`src/acceptance-data.mjs` is hand-derived from the recipe and finish-bar reference files. It must be updated manually when any of these files change:

- `references/recipe-dashboard.md` — `## Acceptance bar` section
- `references/recipe-landing.md` — `## Acceptance bar` section
- `references/recipe-auth.md` — `## Acceptance bar` section
- `references/finish-bar.md` — 10 pass descriptions

**v1 is manual** — no generator script. A generator is deferred. When updating: edit `src/acceptance-data.mjs` directly (an ESM module, `export default { … }`), following the existing `{ id, description, category }` schema. It's a module rather than JSON so it inlines into the published bundle and loads from source on every Node version.

## Development

```bash
cd mcp
npm install
npm test        # node --test (zero external deps)
node src/server.mjs  # run server directly
```

## Node Version

Requires Node.js >= 18.
