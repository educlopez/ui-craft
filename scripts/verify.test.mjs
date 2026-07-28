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
