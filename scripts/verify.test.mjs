import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  SUITES,
  compareGoVersions,
  formatGoToolchainError,
  inspectGoToolchain,
  parseGoDirective,
  parseGoToolchainVersion,
  requiredGoVersionFromMod,
  suitesNeedGo,
} from "./verify.mjs"

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

test("Go suites are detected from the command they run", () => {
  assert.equal(suitesNeedGo(SUITES), true)
  assert.equal(
    suitesNeedGo(SUITES.filter((suite) => suite.id === "mcp")),
    false,
  )
  assert.equal(
    suitesNeedGo(SUITES.filter((suite) => suite.id === "go-format")),
    true,
  )
})

test("go.mod directive and go version strings parse for comparison", () => {
  assert.deepEqual(parseGoDirective("module x\n\ngo 1.23\n"), {
    major: 1,
    minor: 23,
    patch: 0,
    label: "1.23",
  })
  assert.deepEqual(parseGoToolchainVersion("go version go1.22.2 linux/amd64"), {
    major: 1,
    minor: 22,
    patch: 2,
    label: "1.22.2",
  })
  assert.ok(
    compareGoVersions(
      parseGoToolchainVersion("go1.22.2"),
      parseGoDirective("go 1.23"),
    ) < 0,
  )
  assert.ok(
    compareGoVersions(
      parseGoToolchainVersion("go1.23.12"),
      parseGoDirective("go 1.23"),
    ) >= 0,
  )
})

test("required Go version is the directive in cli/go.mod", () => {
  const required = requiredGoVersionFromMod()
  assert.equal(required.major, 1)
  assert.equal(required.minor, 23)
})

test("Cloud Agent install pin stays at or above cli/go.mod", () => {
  const install = readFileSync(
    fileURLToPath(new URL("../.cursor/install.sh", import.meta.url)),
    "utf8",
  )
  const pin = install.match(/^GO_VERSION="([^"]+)"$/m)
  assert.ok(pin, "install.sh must pin GO_VERSION")
  const pinned = parseGoToolchainVersion(`go${pin[1]}`)
  assert.ok(
    compareGoVersions(pinned, requiredGoVersionFromMod()) >= 0,
    `GO_VERSION=${pin[1]} is below cli/go.mod`,
  )
})

test("toolchain error names the installed version, the floor, and how to fix it", () => {
  const required = parseGoDirective("go 1.23")
  const message = formatGoToolchainError({
    required,
    installed: parseGoToolchainVersion("go1.22.2"),
  })
  assert.match(message, /Go 1\.22\.2 is on PATH/)
  assert.match(message, /cli\/go\.mod requires Go >= 1\.23/)
  assert.match(message, /https:\/\/go\.dev\/dl\//)
  assert.match(message, /\.cursor\/install\.sh/)
})

test("inspectGoToolchain fails closed when go is missing from PATH", () => {
  const result = inspectGoToolchain({
    required: parseGoDirective("go 1.23"),
    env: { ...process.env, PATH: "/var/empty" },
  })
  assert.equal(result.ok, false)
  assert.match(result.message, /was not found on PATH/)
})

test("inspectGoToolchain reports spawn errors other than ENOENT with their detail", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-go-eacces-"))
  writeFileSync(join(dir, "go"), "#!/bin/sh\necho should-not-run\n", { mode: 0o644 })
  const result = inspectGoToolchain({
    required: parseGoDirective("go 1.23"),
    env: { ...process.env, PATH: dir },
  })
  assert.equal(result.ok, false)
  assert.doesNotMatch(result.message, /was not found on PATH/)
  assert.match(result.message, /Unable to start `go`/)
  assert.match(result.message, /EACCES|EPERM/)
})

test("inspectGoToolchain rejects a parseable go version that exited nonzero", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-go-nonzero-"))
  writeFileSync(
    join(dir, "go"),
    "#!/bin/sh\necho 'go version go1.23.12 linux/amd64'\nexit 7\n",
    { mode: 0o755 },
  )
  const result = inspectGoToolchain({
    required: parseGoDirective("go 1.23"),
    env: { ...process.env, PATH: dir },
  })
  assert.equal(result.ok, false)
  assert.match(result.message, /exited 7/)
  assert.match(result.message, /go1\.23\.12/)
  assert.doesNotMatch(result.message, /was not found on PATH/)
})

function spawnVerify(args, pathPrefix) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./verify.mjs", import.meta.url)), ...args],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${pathPrefix}${delimiter}${process.env.PATH}` },
    },
  )
}

test("verify --list still works when PATH has an old go", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-old-go-"))
  writeFileSync(
    join(dir, "go"),
    "#!/bin/sh\necho 'go version go1.22.2 linux/amd64'\n",
    { mode: 0o755 },
  )
  const result = spawnVerify(["--list"], dir)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /go-test/)
})

test("verify fails before Go suites when PATH has Go 1.22", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-old-go-"))
  writeFileSync(
    join(dir, "go"),
    "#!/bin/sh\necho 'go version go1.22.2 linux/amd64'\n",
    { mode: 0o755 },
  )
  const result = spawnVerify(["--suite=go-vet"], dir)
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Go 1\.22\.2 is on PATH/)
  assert.match(result.stderr, /cli\/go\.mod requires Go >= 1\.23/)
  assert.match(result.stderr, /\.cursor\/install\.sh/)
  assert.doesNotMatch(result.stdout + result.stderr, /Go vet/)
})

test("verify fails before Go suites when go version exits nonzero", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-go-fail-"))
  writeFileSync(
    join(dir, "go"),
    "#!/bin/sh\necho 'go version go1.23.12 linux/amd64'\nexit 7\n",
    { mode: 0o755 },
  )
  const result = spawnVerify(["--suite=go-vet"], dir)
  assert.equal(result.status, 2)
  assert.match(result.stderr, /exited 7/)
  assert.doesNotMatch(result.stdout + result.stderr, /Go vet/)
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
