import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

function startServer() {
  const child = spawn(process.execPath, ['server/mcp-server.mjs'], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
  const messages = new Map();
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const message = JSON.parse(line);
      messages.set(message.id, message);
    }
  });
  return { child, messages };
}

function waitFor(messages, id) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`No response for request ${id}`)), 1000);
    const poll = setInterval(() => {
      if (!messages.has(id)) return;
      clearTimeout(timeout);
      clearInterval(poll);
      resolve(messages.get(id));
    }, 10);
  });
}

test('the MCP server lists tools and returns structured Workday data', async () => {
  const { child, messages } = startServer();
  try {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
    const initialization = await waitFor(messages, 1);
    assert.equal(initialization.result.protocolVersion, '2026-07-28');

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
    const list = await waitFor(messages, 2);
    assert.equal(list.result.tools.length, 6);
    assert.equal(list.result.tools[0].name, 'workday.search_workers');

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'workday.get_onboarding_status', arguments: {} } })}\n`);
    const call = await waitFor(messages, 3);
    assert.equal(call.result.structuredContent.follow_up_needed, 5);
    assert.equal(call.result.isError, false);
  } finally {
    child.kill();
  }
});
