/**
 * Tests for check-versions-md.mjs.
 *
 * Each case reproduces a hazard that actually shipped, by mutating a copy of the real file
 * and asserting the guard fails. A guard is only worth its runtime if it has been shown to
 * fail — one that has only ever passed is indistinguishable from one that checks nothing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const FILE = `${ROOT}VERSIONS.md`
const BAK = `${ROOT}VERSIONS.md.testbak`

const run = () => {
  try {
    return { code: 0, out: execFileSync("node", [`${ROOT}scripts/check-versions-md.mjs`], { encoding: "utf8", stdio: "pipe" }) }
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }
  }
}

/** Mutate the real file, run, always restore — a failing test must not leave it broken. */
const withMutation = (mutate) => {
  copyFileSync(FILE, BAK)
  try {
    writeFileSync(FILE, mutate(readFileSync(FILE, "utf8")))
    return run()
  } finally {
    copyFileSync(BAK, FILE)
    execFileSync("rm", ["-f", BAK])
  }
}

test("passes on the real file", () => {
  const { code, out } = run()
  assert.equal(code, 0, out)
  assert.match(out, /entries ordered/)
})

test("hazard 1: ascending CLI entries would tag the wrong release", () => {
  const { code, out } = withMutation((s) => {
    const [, block] = s.match(/(## v1\.0\.14 [\s\S]*?)(?=\n## )/)
    return s.replace(block, "").replace("## v1.0.12", `${block}\n## v1.0.12`)
  })
  assert.equal(code, 1)
  assert.match(out, /would tag v1\.0\.13.*but v1\.0\.14.*is newer/s)
})

test("hazard 2: an MCP entry between CLI entries swallows itself into the notes", () => {
  const { code, out } = withMutation((s) => {
    const [, block] = s.match(/(## v1\.0\.14 [\s\S]*?)(?=\n## )/)
    return s.replace(block, "").replace("## ui-craft-mcp v0.8.2", `${block}\n## ui-craft-mcp v0.8.2`)
  })
  assert.equal(code, 1)
  assert.match(out, /sits between the first two CLI entries/)
})

test("hazard 3: a version sweep rewriting a shipped pin", () => {
  const { code, out } = withMutation((s) => s.replaceAll("ui-craft-mcp@0.8.1", "ui-craft-mcp@0.8.2"))
  assert.equal(code, 1)
  assert.match(out, /but tag v1\.0\.1[34] shipped @0\.8\.1/)
})

test("hazard 4: a pin ahead of the manifest", () => {
  const { code, out } = withMutation((s) => s.replace("ui-craft-mcp@0.8.1", "ui-craft-mcp@9.9.9"))
  assert.equal(code, 1)
  assert.match(out, /ahead of the manifest/)
})

test("a redaction or a supersession note is NOT flagged", () => {
  // Both happened in real history: "(gentle-ai parity)" removed from a shipped entry, and
  // v0.24.0 retitled "superseded by v0.25". Prose may change; only pins may not.
  const { code } = withMutation((s) =>
    s.replace("## v1.0.13 (2026-08-03) — Current MCP pin", "## v1.0.13 (2026-08-03) — Current MCP pin (superseded)"),
  )
  assert.equal(code, 0)
})
