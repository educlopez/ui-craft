#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const GO_MOD_REL = "cli/go.mod"

export const SUITES = Object.freeze([
  {
    id: "action-pins",
    label: "GitHub Actions pinned to SHAs",
    command: "node",
    args: ["scripts/check-action-pins.mjs"],
  },
  {
    id: "versions",
    label: "VERSIONS.md release hazards",
    command: "node",
    args: ["scripts/check-versions-md.mjs"],
  },
  {
    id: "version-mentions",
    label: "Every stated MCP pin matches the manifest",
    command: "node",
    args: ["scripts/check-version-mentions.mjs"],
  },
  {
    id: "frontmatter",
    label: "Shipped frontmatter (independent YAML parser)",
    command: "node",
    args: ["scripts/check-frontmatter-strict.mjs"],
  },
  {
    // Runs the checker, not only its tests. Nothing invoked check-distribution-contract.mjs
    // before: the suite below runs its test file, and no workflow called `pnpm
    // check:distribution`. Launcher drift was still caught — "distribution manifest matches
    // package and launcher sources" in verify.test.mjs asserts the real files — but through a
    // test that reimplements one of the checker's rules rather than through the checker,
    // which also validates launcher shape (npx, exact args) and the compatibility rows.
    // Those went unenforced.
    id: "contracts",
    label: "Distribution contract",
    command: "node",
    args: ["scripts/check-distribution-contract.mjs"],
  },
  {
    id: "contracts-unit",
    label: "Distribution contract unit tests",
    command: "node",
    args: [
      "--test",
      "scripts/check-distribution-contract.test.mjs",
      "scripts/verify.test.mjs",
      "scripts/cursor-plugin.test.mjs",
    ],
  },
  {
    id: "validate",
    label: "Plugin structure, metadata, and links",
    command: "node",
    args: ["scripts/validate.mjs"],
  },
  {
    // references/coverage.md is generated from mcp/src/coverage-data.mjs. It is the
    // fallback for installs without the MCP server, so a stale copy fails only for
    // the users with the least tooling — exactly the failure nobody reports. Checked
    // before the mirror gate, since mirroring a stale file just propagates it.
    id: "coverage-ref",
    label: "references/coverage.md matches coverage-data.mjs",
    command: "node",
    args: ["scripts/build-coverage-reference.mjs", "--check"],
  },
  {
    id: "mirrors",
    label: "Canonical source mirrors",
    command: "node",
    args: ["scripts/check-mirror-copies.mjs"],
  },
  {
    id: "detector",
    label: "Detector",
    command: "node",
    args: ["--test", "scripts/detect.test.mjs"],
  },
  {
    id: "fold",
    label: "Fold composition analyser",
    command: "node",
    args: ["--test", "scripts/fold/fold.test.mjs"],
  },
  {
    id: "quality-unit",
    label: "Quality evaluator unit tests",
    command: "node",
    args: ["--test", "evals/quality/score.test.mjs"],
  },
  {
    id: "quality-baseline",
    label: "Quality evaluator baseline",
    command: "node",
    args: ["scripts/eval.mjs", "--baseline"],
  },
  {
    id: "mcp",
    label: "MCP source tests",
    command: "npm",
    args: ["test", "--prefix", "mcp"],
  },
  {
    id: "mcp-dist",
    label: "MCP published-bundle smoke test",
    command: "npm",
    args: ["run", "smoke:dist", "--prefix", "mcp"],
  },
  {
    id: "go-test",
    label: "Go tests with race detector",
    command: "go",
    args: ["test", "-race", "./..."],
    cwd: "cli",
  },
  {
    id: "go-vet",
    label: "Go vet",
    command: "go",
    args: ["vet", "./..."],
    cwd: "cli",
  },
  {
    id: "go-format",
    label: "Go formatting",
    command: "gofmt",
    args: ["-l", "."],
    cwd: "cli",
    expectNoStdout: true,
  },
])

export function suitesNeedGo(suites) {
  return suites.some((suite) => suite.command === "go" || suite.command === "gofmt")
}

export function parseGoToolchainVersion(text) {
  const match = String(text ?? "").match(/\bgo(\d+)\.(\d+)(?:\.(\d+))?\b/)
  if (!match) return null
  const patch = match[3] ? Number(match[3]) : 0
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch,
    label: match[3] ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}.${match[2]}`,
  }
}

export function parseGoDirective(modSource) {
  const match = String(modSource ?? "").match(/^go\s+(\d+)\.(\d+)(?:\.(\d+))?\s*(?:\/\/.*)?$/m)
  if (!match) return null
  return parseGoToolchainVersion(`go${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ""}`)
}

export function compareGoVersions(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function formatGoToolchainError({
  required,
  installed,
  missing,
  unparseable,
  startup,
  commandFailed,
}) {
  const need = `Go >= ${required.label}`
  let lines
  if (missing) {
    lines = [`\`go\` was not found on PATH; ${GO_MOD_REL} requires ${need}.`]
  } else if (startup) {
    lines = [`Unable to start \`go\`: ${startup}`]
  } else if (commandFailed != null) {
    lines = [
      `\`go version\` exited ${commandFailed.status}; ${GO_MOD_REL} requires ${need}.`,
      `Output: ${commandFailed.output || "(empty)"}`,
    ]
  } else if (unparseable != null) {
    lines = [
      `Could not parse \`go version\` output; ${GO_MOD_REL} requires ${need}.`,
      `Output: ${unparseable || "(empty)"}`,
    ]
  } else {
    lines = [`Go ${installed.label} is on PATH; ${GO_MOD_REL} requires ${need}.`]
  }

  lines.push(
    "",
    `Install ${need} from https://go.dev/dl/ and put its bin directory first on PATH.`,
    "A distro go under /usr/bin is often too old; the newer binary must win.",
    "Cloud Agents: run `bash .cursor/install.sh` (the environment install step).",
  )
  return lines.join("\n")
}

export function requiredGoVersionFromMod(modSource = readFileSync(resolve(ROOT, GO_MOD_REL), "utf8")) {
  const required = parseGoDirective(modSource)
  if (!required) {
    throw new Error(`Could not read a go directive from ${GO_MOD_REL}`)
  }
  return required
}

export function inspectGoToolchain({
  required = requiredGoVersionFromMod(),
  env = process.env,
} = {}) {
  const result = spawnSync("go", ["version"], { encoding: "utf8", env })
  if (result.error) {
    if (result.error.code === "ENOENT") {
      return { ok: false, message: formatGoToolchainError({ required, missing: true }) }
    }
    const detail = result.error.code
      ? `${result.error.message} (${result.error.code})`
      : result.error.message
    return { ok: false, message: formatGoToolchainError({ required, startup: detail }) }
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  if (result.status !== 0) {
    return {
      ok: false,
      message: formatGoToolchainError({ required, commandFailed: { status: result.status, output } }),
    }
  }
  const installed = parseGoToolchainVersion(output)
  if (!installed) {
    return { ok: false, message: formatGoToolchainError({ required, unparseable: output }) }
  }
  if (compareGoVersions(installed, required) < 0) {
    return { ok: false, message: formatGoToolchainError({ required, installed }) }
  }
  return { ok: true, installed, required }
}

export function runSuite(suite) {
  const result = spawnSync(suite.command, suite.args, {
    cwd: resolve(ROOT, suite.cwd ?? "."),
    encoding: "utf8",
    env: process.env,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.error) {
    console.error(`Unable to start ${suite.command}: ${result.error.message}`)
    return false
  }
  if (result.status !== 0) return false
  if (suite.expectNoStdout && result.stdout.trim() !== "") {
    console.error("The following files are not formatted:")
    console.error(result.stdout.trim())
    return false
  }
  return true
}

function main() {
  if (process.argv.includes("--list")) {
    for (const suite of SUITES) console.log(`${suite.id}\t${suite.label}`)
    return
  }

  const selected = process.argv
    .filter((arg) => arg.startsWith("--suite="))
    .map((arg) => arg.slice("--suite=".length))
  const suites = selected.length
    ? SUITES.filter((suite) => selected.includes(suite.id))
    : SUITES

  const unknown = selected.filter((id) => !SUITES.some((suite) => suite.id === id))
  if (unknown.length > 0) {
    console.error(`Unknown suite(s): ${unknown.join(", ")}`)
    process.exitCode = 2
    return
  }

  // Distro Go 1.22 cannot build a go 1.23 module, and its toolchain download
  // fails with "toolchain not available". Fail before any suite so the message
  // is the first thing on the screen, not buried under go-test/go-vet noise.
  if (suitesNeedGo(suites)) {
    const toolchain = inspectGoToolchain()
    if (!toolchain.ok) {
      console.error(toolchain.message)
      process.exitCode = 2
      return
    }
  }

  const failed = []
  for (const [index, suite] of suites.entries()) {
    console.log(`\n[${index + 1}/${suites.length}] ${suite.label} (${suite.id})`)
    console.log("─".repeat(72))
    if (!runSuite(suite)) failed.push(suite.id)
  }

  console.log("\n" + "═".repeat(72))
  if (failed.length === 0) {
    console.log(`✓ verify passed: ${suites.length}/${suites.length} suites`)
    return
  }

  console.error(
    `✗ verify failed: ${failed.length}/${suites.length} suite(s): ${failed.join(", ")}`,
  )
  console.error("All selected suites ran; failures above were not fail-fast.")
  process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
