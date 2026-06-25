/**
 * Build the publishable bundle.
 *
 * The server's tools import from OUTSIDE this package at dev time — the shared
 * source of truth lives at the repo root (`../scripts/detect.mjs`,
 * `../evals/quality/score.mjs`, etc.). Those relative paths don't exist in an
 * npm tarball, so we bundle everything reachable from server.mjs into one
 * self-contained `dist/server.mjs`. Only the real runtime deps
 * (@modelcontextprotocol/sdk, zod) stay external and are resolved from
 * node_modules at install time.
 *
 * Run from the repo (where the ../scripts and ../evals sources resolve):
 *   npm run build   (inside mcp/)
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(__dirname, 'src', 'server.mjs')],
  outfile: join(__dirname, 'dist', 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  // Keep the declared runtime deps external; inline all first-party source
  // (detect.mjs, score.mjs, tokens-rules.mjs, a11y-static.mjs, acceptance-data.mjs).
  external: ['@modelcontextprotocol/sdk', 'zod'],
  // Dead-code the inlined CLI entry guards (detect.mjs runs main()+process.exit
  // when its import.meta.url matches argv[1] — true once bundled into the server).
  define: { 'process.env.UI_CRAFT_BUNDLE': '"1"' },
  // server.mjs already begins with a shebang; esbuild preserves the entry
  // shebang, so the bundled bin stays directly executable.
  legalComments: 'none',
  logLevel: 'info',
});

console.log('✓ bundled → mcp/dist/server.mjs');
