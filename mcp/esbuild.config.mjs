/**
 * Build the self-contained production SDK v2 runtime from the tested adapter.
 * Bootstrap its pinned toolchain first:
 * pnpm --dir ../experiments/skills-mcp install --frozen-lockfile --ignore-scripts
 *
 * The npm tarball contains dist only: no first-run SDK dependency downloads.
 * Canonical tool registrations remain in src/server.mjs and are adapted at build.
 */
process.argv.push('--production');
await import('../experiments/skills-mcp/build.mjs');
