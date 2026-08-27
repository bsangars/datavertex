#!/usr/bin/env node
import { tools } from './tools/catalog.mjs';
import { mockResults } from './tools/mock-results.mjs';

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
      serverInfo: { name: 'vertex-agent-demo', version: '0.1.0' },
      instructions: 'Demo server exposes non-sensitive, read-only sample data only.'
    });
    return;
  }

  if (request.method === 'tools/list') {
    reply(request.id, { tools });
    return;
  }

  if (request.method === 'tools/call') {
    const toolName = request.params?.name;
    if (!mockResults[toolName]) {
      error(request.id, -32602, `Unknown tool: ${toolName}`);
      return;
    }
    const result = mockResults[toolName];
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
