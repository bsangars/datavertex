import { tools } from './tools/catalog.mjs';
import { runTool } from './tools/handlers.mjs';

const protocolVersion = '2026-07-28';
let buffer = '';

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function error(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

function handle(request) {
  if (request.method === 'notifications/initialized') return;

  if (request.method === 'initialize') {
    reply(request.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'vertex-agent-demo', version: '0.2.0' },
      instructions: 'Demo server exposes non-sensitive, read-only data from a local SQLite database.'
    });
    return;
  }

  if (request.method === 'tools/list') {
    reply(request.id, { tools });
    return;
  }

  if (request.method === 'tools/call') {
    const toolName = request.params?.name;
    const args = request.params?.arguments || {};
    const result = runTool(toolName, args);
    if (!result) {
      error(request.id, -32602, `Unknown tool: ${toolName}`);
      return;
    }
    reply(request.id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false
    });
    return;
  }

  error(request.id, -32601, `Method not found: ${request.method}`);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line));
    } catch {
      error(null, -32700, 'Parse error');
    }
  }
});
