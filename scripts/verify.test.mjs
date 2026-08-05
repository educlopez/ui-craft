import assert from "node:assert/strict"
import test from "node:test"

import { SUITES } from "./verify.mjs"

test("canonical verify gate covers every distribution surface", () => {
  const ids = new Set(SUITES.map((suite) => suite.id))
  for (const required of [
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

test(`skill references — ${SITE_COUNTS} says 33`, async () => {
  const { readdirSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const dir = fileURLToPath(new URL("../skills/ui-craft/references", import.meta.url))
  const refs = readdirSync(dir).filter((f) => f.endsWith(".md"))

  assert.equal(
    refs.length,
    33,
    `references/ now has ${refs.length} files. Update "references" in ${SITE_COUNTS}, then this assertion.`,
  )
})

test(`MCP tools registered — ${SITE_COUNTS} says 7`, async () => {
  const { readFileSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const src = readFileSync(fileURLToPath(new URL("../mcp/src/server.mjs", import.meta.url)), "utf8")
  const registered = [...src.matchAll(/server\.registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1])

  assert.equal(
    registered.length,
    7,
    `server.mjs registers ${registered.length} tools (${registered.join(", ")}). ` +
      `Update "mcpTools" in ${SITE_COUNTS}, then this assertion.`,
  )
})
