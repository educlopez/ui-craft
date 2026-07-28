import { readFileSync } from 'node:fs';

const sourceVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

export const MCP_VERSION = sourceVersion;
