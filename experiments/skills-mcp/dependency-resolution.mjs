// Canonical sources live outside this package. Resolve their direct Zod import
// against this candidate's lockfile, never an accidental mcp/node_modules copy.
export function installLocalZodResolver(context, resolveDir) {
  context.onResolve({ filter: /^zod$/ }, args => {
    if (args.pluginData?.uiCraftLocalZod) return undefined;
    return context.resolve('zod', { resolveDir, kind: args.kind,
      pluginData: { uiCraftLocalZod: true } });
  });
}
