#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const SUITES = Object.freeze([
  {
    id: "contracts",
    label: "Distribution contract",
    command: "node",
    args: [
      "--test",
      "scripts/check-distribution-contract.test.mjs",
      "scripts/verify.test.mjs",
    ],
  },
  {
    id: "validate",
    label: "Plugin structure, metadata, and links",
    command: "node",
    args: ["scripts/validate.mjs"],
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
