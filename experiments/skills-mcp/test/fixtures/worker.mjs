import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A deterministic legacy MCP peer, not a browser. Its descendant ignores TERM
// to prove cleanup targets the entire owned group and escalates to KILL.
process.on('SIGTERM', () => {});
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  let newline;
  while ((newline = input.indexOf('\n')) >= 0) {
    const message = JSON.parse(input.slice(0, newline));
    input = input.slice(newline + 1);
    const reply = result => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
    if (message.method === 'initialize') reply({ protocolVersion: '2025-11-25',
      capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '0' } });
    if (message.method === 'tools/list') reply({ tools: [{ name: 'slow', inputSchema: { type: 'object' } }] });
    if (message.method === 'tools/call') {
      const args = message.params.arguments;
      const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { stdio: 'ignore' });
      writeFileSync(join(process.env.TMPDIR, 'descendant.pid'), String(child.pid));
      if (!args.hang) setTimeout(() => reply({ content: [{ type: 'text', text: 'done' }] }), args.delay ?? 0);
    }
  }
});
