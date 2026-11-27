import { McpServer as V2Server } from '@modelcontextprotocol/server';
import { loadSkills } from '@modelcontextprotocol/server/ext/skills/node';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { BRANDING, ICONS, toolAnnotations } from './metadata.mjs';
import { runTool } from './tool-runner.mjs';

// Build-time adapter only: the published v1 entry point is never edited.
export class McpServer extends V2Server {
  constructor(info, options) {
    super({ ...info, ...BRANDING }, options);
  }

  registerTool(name, config, callback) {
    const schema = (value) => value && typeof value.safeParse !== 'function'
      ? z.object(value) : value;
    let output = config.outputSchema;
    // Scanners return extra finding metadata (e.g. confidence). The legacy
    // server validates with Zod but returns the original object, while its
    // advertised JSON schema forbids that metadata. Preserve the payload;
    // accurately allow those keys in the experimental schema only.
    if (output?.findings instanceof z.ZodArray && output.findings.element instanceof z.ZodObject) {
      output = { ...output, findings: z.array(output.findings.element.passthrough()) };
    }
    return super.registerTool(name, {
      ...config,
      icons: ICONS,
      annotations: toolAnnotations(name),
      inputSchema: schema(config.inputSchema),
      outputSchema: schema(output),
    }, process.env.UI_CRAFT_MCP_TOOL_WORKER === '1' ? callback : async (args, ctx) => {
      try {
        return await runTool(name, args, ctx.mcpReq);
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error?.message ?? String(error) }] };
      }
    });
  }

}

export async function loadCatalog() {
  const flag = process.env.UI_CRAFT_MCP_SKILLS;
  if (flag !== undefined && flag !== '0' && flag !== '1') {
    throw new Error('UI_CRAFT_MCP_SKILLS must be 0 or 1');
  }
  // Resolve against the bundle, never the caller's working directory.
  return flag === '1'
    ? loadSkills(fileURLToPath(new URL('./skills/', import.meta.url)), { strict: true })
    : undefined;
}
