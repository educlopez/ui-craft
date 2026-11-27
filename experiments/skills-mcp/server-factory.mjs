// Adapt the canonical server without rewriting it. Windows checkouts may use CRLF.
export function wrapLegacyServer(input) {
  const source = input.replaceAll('\r\n', '\n').replace(/^#![^\n]*\n/, '');
  const start = source.indexOf('const server = new McpServer(');
  const end = source.indexOf('const transport = new StdioServerTransport();');
  if (start < 0 || end < start || !source.endsWith('await server.connect(transport);\n')) {
    throw new Error('Legacy server layout changed: review the SDK v2 factory adapter');
  }
  return `${source.slice(0, start)}\nexport function createServer() {\n${source.slice(start, end)}\nreturn server;\n}\n`;
}
