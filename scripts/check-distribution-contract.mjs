#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"))
}

function valueType(value) {
  if (Array.isArray(value)) return "array"
  if (value === null) return "null"
  return typeof value
}

/**
 * Validate the subset of JSON Schema 2020-12 used by this repository's schema.
 * Keeping this tiny and explicit avoids adding a runtime dependency while still
 * making the checked schema file—not duplicated imperative checks—the authority.
 */
export function validateSchema(value, schema, path = "$") {
  const failures = []
  const actualType = valueType(value)

  if (schema.type && actualType !== schema.type) {
    return [`${path}: expected ${schema.type}, got ${actualType}`]
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    failures.push(`${path}: expected constant ${JSON.stringify(schema.const)}`)
  }
  if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    failures.push(`${path}: expected ISO date (YYYY-MM-DD)`)
  }

  if (actualType === "object") {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) failures.push(`${path}: missing required property ${key}`)
    }
    for (const [key, item] of Object.entries(value)) {
      const childSchema = schema.properties?.[key]
      if (childSchema) {
        failures.push(...validateSchema(item, childSchema, `${path}.${key}`))
      } else if (schema.additionalProperties === false) {
        failures.push(`${path}: unexpected property ${key}`)
      }
    }
  }

  if (actualType === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      failures.push(`${path}: expected at least ${schema.minItems} item(s)`)
    }
    if (schema.items) {
      value.forEach((item, index) => {
        failures.push(...validateSchema(item, schema.items, `${path}[${index}]`))
      })
    }
  }

  return failures
}

function stripGoComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

export function parseLauncher(launcher, content) {
  if (launcher.format === "mcp-json") {
    const parsed = JSON.parse(content)
    const config = parsed.mcpServers?.[launcher.server]
    if (!config || typeof config !== "object") {
      throw new Error(`missing mcpServers.${launcher.server}`)
    }
    return { command: config.command, args: config.args }
  }

  if (launcher.format === "go-mcp-server") {
    const symbol = launcher.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const source = stripGoComments(content)
    const declaration = source.match(
      new RegExp(
        `\\bvar\\s+${symbol}\\s*=\\s*harness\\.MCPServer\\s*\\{([\\s\\S]*?)\\n\\}`,
      ),
    )
    if (!declaration) throw new Error(`missing harness.MCPServer variable ${launcher.symbol}`)
    const command = declaration[1].match(/\bCommand\s*:\s*"([^"]+)"/)?.[1]
    const argsBody = declaration[1].match(/\bArgs\s*:\s*\[\]string\s*\{([^}]*)\}/)?.[1]
    const args = argsBody ? [...argsBody.matchAll(/"([^"]*)"/g)].map((match) => match[1]) : null
    return { command, args }
  }

  throw new Error(`unsupported launcher format ${launcher.format}`)
}

export function marketplaceListingIsValid(manifestListing, marketplace, plugin) {
  const listing = marketplace.plugins?.find((item) => item.name === plugin.name)
  return (
    manifestListing.name === plugin.name &&
    listing?.name === plugin.name &&
    /^\d{4}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12]\d|3[01])\.(?:[01]\d|2[0-3])[0-5]\d$/.test(
      listing.version,
    )
  )
}

export function checkDistributionContract({ root = ROOT } = {}) {
  const failures = []
  const manifest = readJson(root, "distribution-manifest.json")
  const schema = readJson(root, "schemas/distribution-manifest.schema.json")
  failures.push(...validateSchema(manifest, schema).map((item) => `schema: ${item}`))

  // Stop semantic traversal after a structural failure; missing nested fields
  // should be reported once by the schema rather than causing a TypeError.
  if (failures.length > 0) return { failures, manifest }

  const detectorPackage = readJson(root, "package.json")
  const mcpPackage = readJson(root, "mcp/package.json")
  const plugin = readJson(root, ".claude-plugin/plugin.json")
  const marketplace = readJson(root, ".claude-plugin/marketplace.json")

  const checks = [
    [
      "detector package version matches",
      manifest.components.detector.package === detectorPackage.name &&
        manifest.components.detector.version === detectorPackage.version,
    ],
    [
      "MCP package version matches",
      manifest.components.mcp.package === mcpPackage.name &&
        manifest.components.mcp.version === mcpPackage.version,
    ],
    [
      "MCP invocation is an exact version pin",
      manifest.components.mcp.invocation === `${mcpPackage.name}@${mcpPackage.version}`,
    ],
    [
      "Claude plugin version matches",
      manifest.components.claudePlugin.name === plugin.name &&
        manifest.components.claudePlugin.version === plugin.version,
    ],
    [
      "marketplace listing metadata is valid",
      marketplaceListingIsValid(
        manifest.components.marketplaceListing,
        marketplace,
        plugin,
      ),
    ],
  ]
  for (const [label, ok] of checks) {
    if (!ok) failures.push(label)
  }

  const invocation = manifest.components.mcp.invocation
  for (const launcher of manifest.pinnedLaunchers) {
    const path = resolve(root, launcher.path)
    if (!existsSync(path)) {
      failures.push(`pinned launcher is missing: ${launcher.path}`)
      continue
    }
    try {
      const parsed = parseLauncher(launcher, readFileSync(path, "utf8"))
      if (parsed.command !== "npx") {
        failures.push(`pinned launcher command is not npx: ${launcher.path}`)
      }
      if (
        !Array.isArray(parsed.args) ||
        parsed.args.length !== 2 ||
        parsed.args[0] !== "-y" ||
        parsed.args[1] !== invocation
      ) {
        failures.push(
          `pinned launcher args must be ["-y", "${invocation}"]: ${launcher.path}`,
        )
      }
    } catch (error) {
      failures.push(`pinned launcher is invalid (${launcher.path}): ${error.message}`)
    }
  }

  for (const [name, source] of Object.entries(manifest.canonicalSources)) {
    const path = resolve(root, source)
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      failures.push(`canonical source directory is missing (${name}): ${source}`)
    }
  }

  const requiredContracts = new Set(
    Object.values(manifest.components)
      .map((component) => component.contract)
      .filter(Boolean),
  )
  const declaredRequirements = new Set(
    manifest.compatibility.flatMap((entry) => entry.requires),
  )
  for (const contract of requiredContracts) {
    if (!declaredRequirements.has(contract)) {
      failures.push(`component contract is absent from compatibility matrix: ${contract}`)
    }
  }

  return { failures, manifest }
}

function main() {
  let result
  try {
    result = checkDistributionContract()
  } catch (error) {
    console.error(`✗ distribution contract could not be read: ${error.message}`)
    process.exitCode = 2
    return
  }

  if (result.failures.length > 0) {
    console.error("✗ distribution contract drift detected:")
    for (const failure of result.failures) console.error(`  • ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(
    `✓ distribution contract: ${result.manifest.components.mcp.invocation}; ` +
      `${result.manifest.compatibility.length} compatibility rows`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
