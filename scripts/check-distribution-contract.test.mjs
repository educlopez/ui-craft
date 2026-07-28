import assert from "node:assert/strict"
import test from "node:test"

import {
  checkDistributionContract,
  marketplaceListingIsValid,
  parseLauncher,
  validateSchema,
} from "./check-distribution-contract.mjs"

test("distribution manifest matches package and launcher sources", () => {
  const result = checkDistributionContract()
  assert.deepEqual(result.failures, [])
})

test("schema validation rejects missing, unknown, and incorrectly typed fields", () => {
  const schema = {
    type: "object",
    required: ["version"],
    properties: { version: { type: "string" } },
    additionalProperties: false,
  }
  assert.deepEqual(validateSchema({}, schema), ["$: missing required property version"])
  assert.deepEqual(validateSchema({ version: 2 }, schema), [
    "$.version: expected string, got number",
  ])
  assert.deepEqual(validateSchema({ version: "1", comment: "spoof" }, schema), [
    "$: unexpected property comment",
  ])
})

test("MCP JSON launcher is parsed structurally, not by substring", () => {
  const launcher = { format: "mcp-json", server: "ui-craft" }
  assert.deepEqual(
    parseLauncher(
      launcher,
      JSON.stringify({
        comment: "ui-craft-mcp@0.3.0",
        mcpServers: {
          "ui-craft": { command: "npx", args: ["-y", "ui-craft-mcp@0.1.0"] },
        },
      }),
    ),
    { command: "npx", args: ["-y", "ui-craft-mcp@0.1.0"] },
  )
  assert.throws(
    () => parseLauncher(launcher, '{"comment":"ui-craft-mcp@0.3.0"}'),
    /missing mcpServers/,
  )
})

test("Go launcher ignores a pin that appears only in a comment", () => {
  const launcher = {
    format: "go-mcp-server",
    symbol: "mcpServer",
  }
  assert.throws(
    () =>
      parseLauncher(
        launcher,
        `// var mcpServer = harness.MCPServer{
//   Command: "npx",
//   Args: []string{"-y", "ui-craft-mcp@0.3.0"},
// }`,
      ),
    /missing harness\.MCPServer/,
  )
})

test("Go launcher parses the Args slice structurally across formatting", () => {
  const launcher = {
    format: "go-mcp-server",
    symbol: "mcpServer",
  }
  assert.deepEqual(
    parseLauncher(
      launcher,
      `var mcpServer = harness.MCPServer{
  Name: "ui-craft",
  Command: "npx",
  Args: []string{
    "-y",
    "ui-craft-mcp@0.3.0",
  },
}`,
    ),
    { command: "npx", args: ["-y", "ui-craft-mcp@0.3.0"] },
  )
})

test("MCP invocation is immutable semver", () => {
  const { manifest } = checkDistributionContract()
  assert.match(
    manifest.components.mcp.invocation,
    /^ui-craft-mcp@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  )
})

test("marketplace CalVer may change without drifting the distribution manifest", () => {
  const manifestListing = { name: "ui-craft" }
  const plugin = { name: "ui-craft" }

  for (const version of ["2026.7.28.1026", "2026.7.28.2359"]) {
    assert.equal(
      marketplaceListingIsValid(
        manifestListing,
        { plugins: [{ name: "ui-craft", version }] },
        plugin,
      ),
      true,
    )
  }

  assert.equal(
    marketplaceListingIsValid(
      manifestListing,
      { plugins: [{ name: "ui-craft", version: "latest" }] },
      plugin,
    ),
    false,
  )
})
