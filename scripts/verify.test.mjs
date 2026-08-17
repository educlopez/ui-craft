import assert from "node:assert/strict"
import test from "node:test"

import { SUITES } from "./verify.mjs"

test("canonical verify gate covers every distribution surface", () => {
  const ids = new Set(SUITES.map((suite) => suite.id))
  for (const required of [
    "action-pins",
    "versions",
    "frontmatter",
    "contracts",
    "validate",
    "mirrors",
    "detector",
    "quality-unit",
    "quality-baseline",
    "mcp",
    "mcp-dist",
    "go-test",
    "go-vet",
    "go-format",
  ]) {
    assert.ok(ids.has(required), `missing suite: ${required}`)
  }
})

test("verify suite ids are unique and commands are explicit", () => {
  const ids = SUITES.map((suite) => suite.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const suite of SUITES) {
    assert.ok(suite.command)
    assert.ok(Array.isArray(suite.args))
  }
})

/**
 * The other end of the docs site's count contract.
 *
 * `ui-craft-docs/src/lib/gate-counts.json` also carries two facts this repo owns
 * and the `ui-craft-detect` tarball does not ship: how many references the skill
 * has, and how many tools the MCP server registers. The site cannot count either,
 * so it keeps a copy — and a copy cannot notice when a file lands here.
 *
 * Both drifted before anything guarded them. The MCP page advertised four tools
 * while the server registered seven, for two releases; the anatomy page said 31
 * references against 33, in six places including a heading and an aria-label.
 * Adding a reference or a tool is meant to fail here, loudly, naming the file to
 * update — that is the whole point of the pin.
 */
const SITE_COUNTS = 'ui-craft-docs/src/lib/gate-counts.json'

test(`skill references — ${SITE_COUNTS} says 34`, async () => {
  const { readdirSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const dir = fileURLToPath(new URL("../skills/ui-craft/references", import.meta.url))
  const refs = readdirSync(dir).filter((f) => f.endsWith(".md"))

  assert.equal(
    refs.length,
    34,
    `references/ now has ${refs.length} files. Update "references" in ${SITE_COUNTS}, then this assertion.`,
  )
})

test(`MCP tools registered — ${SITE_COUNTS} says 8`, async () => {
  const { readFileSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const src = readFileSync(fileURLToPath(new URL("../mcp/src/server.mjs", import.meta.url)), "utf8")
  const registered = [...src.matchAll(/server\.registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1])

  assert.equal(
    registered.length,
    8,
    `server.mjs registers ${registered.length} tools (${registered.join(", ")}). ` +
      `Update "mcpTools" in ${SITE_COUNTS}, then this assertion.`,
  )
})

/**
 * The docs site documents an install snippet with an immutable spec — `npx -y
 * ui-craft-mcp@X.Y.Z` — because an unpinned `npx` resolves to whatever is newest at first
 * run, so two installs of "the same" instructions can behave differently.
 *
 * The pin has a cost: it has to move on every MCP release, and the site cannot derive it
 * (this repo is not a dependency of it). So the site records the expected spec in
 * `gate-counts.json` and its own guard checks the prose against that; this is the other end,
 * and it is why bumping the manifest fails here until the docs are bumped too.
 *
 * Deliberately noisy. A silently stale pin points users at a version that predates the tool
 * they are reading about — which is exactly what happened with route_task, documented on a
 * page whose snippet still installed a server without it.
 */
test("MCP pin — ui-craft-docs/src/lib/gate-counts.json says 0.9.0", async () => {
  const { readFileSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../distribution-manifest.json", import.meta.url)), "utf8"),
  )

  assert.equal(
    manifest.components.mcp.version,
    "0.9.0",
    `The manifest pins ui-craft-mcp@${manifest.components.mcp.version}. Update "mcpPin" in ` +
      "ui-craft-docs/src/lib/gate-counts.json and the snippet in its mcp.md, then this assertion. " +
      "A stale documented pin installs a server older than the page describing it.",
  )
})
