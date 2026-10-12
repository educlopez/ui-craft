import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import {
  discoverCursorPlugin,
  validateCursorPluginManifest,
} from "./cursor-plugin.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

test("repo Cursor plugin manifest matches the documented schema", () => {
  const discovered = discoverCursorPlugin(ROOT)
  assert.deepEqual(discovered.failures, [])
  assert.equal(discovered.manifest.name, "ui-craft")
})

test("schema validation rejects missing name and extra fields", () => {
  assert.ok(validateCursorPluginManifest({}).some((item) => /missing required property name/.test(item)))
  assert.ok(
    validateCursorPluginManifest({ name: "ui-craft", url: "https://example.com" }).some((item) =>
      /unexpected property url/.test(item),
    ),
  )
  assert.ok(
    validateCursorPluginManifest({ name: "UI Craft" }).some((item) => /kebab-case/.test(item)),
  )
  assert.ok(
    validateCursorPluginManifest({ name: "ui-craft", author: { name: "A", url: "https://x" } }).some(
      (item) => /author: unexpected property url/.test(item),
    ),
  )
})

test("discovered plugin components point at the canonical trees", () => {
  const discovered = discoverCursorPlugin(ROOT)
  assert.deepEqual(discovered.skills, [
    "skills/ui-craft",
    "skills/ui-craft-dense-dashboard",
    "skills/ui-craft-editorial",
    "skills/ui-craft-minimal",
  ])
  assert.ok(discovered.commands.includes("commands/craft.md"))
  assert.ok(discovered.agents.includes("agents/design-reviewer.md"))
  assert.ok(discovered.agents.includes("agents/a11y-auditor.md"))
  assert.ok(discovered.rules.every((rule) => rule.startsWith("rules/") && rule.endsWith(".mdc")))
  assert.equal(discovered.mcpServers["ui-craft-mcp"].command, "npx")
  assert.deepEqual(discovered.mcpServers["ui-craft-mcp"].args, ["-y", "ui-craft-mcp@0.9.0"])
  assert.equal(discovered.hookEvents.length, 1)
  assert.equal(discovered.hookEvents[0].event, "preToolUse")
  assert.equal(discovered.hookEvents[0].matcher, "Write")
  assert.match(discovered.hookEvents[0].command, /scripts\/detect\.mjs hook-run/)
})

test("inspect CLI prints every component class", () => {
  const result = spawnSync(process.execPath, [resolve(ROOT, "scripts/cursor-plugin.mjs"), "inspect"], {
    encoding: "utf8",
    cwd: ROOT,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /skills \(/)
  assert.match(result.stdout, /commands \(/)
  assert.match(result.stdout, /agents \(/)
  assert.match(result.stdout, /rules \(/)
  assert.match(result.stdout, /mcpServers \(1\):/)
  assert.match(result.stdout, /ui-craft-mcp:/)
  assert.match(result.stdout, /preToolUse matcher=Write/)
})
