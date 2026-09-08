import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const dbPath = join(process.cwd(), 'data', 'vertex.db');

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

test('the MCP server lists tools and returns SQLite-backed Workday data', async () => {
  try { unlinkSync(dbPath); } catch {}
  const { child, messages } = startServer();
  try {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
    const initialization = await waitFor(messages, 1);
    assert.equal(initialization.result.protocolVersion, '2026-07-28');

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
    const list = await waitFor(messages, 2);
    assert.equal(list.result.tools.length, 10);
    assert.equal(list.result.tools.find(tool => tool.name === 'workday.search_workers').name, 'workday.search_workers');

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'workday.get_onboarding_status', arguments: {} } })}\n`);
    const onboarding = await waitFor(messages, 3);
    assert.equal(onboarding.result.structuredContent.starters, 12);
    assert.equal(onboarding.result.structuredContent.follow_up_needed, 5);
    assert.ok(onboarding.result.structuredContent.pending_tasks >= 5);
    assert.equal(onboarding.result.isError, false);

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'sales.get_pipeline_summary', arguments: {} } })}\n`);
    const pipeline = await waitFor(messages, 4);
    assert.ok(pipeline.result.structuredContent.pipeline_value > 0);
    assert.ok(pipeline.result.structuredContent.open_deals >= 5);
    assert.equal(pipeline.result.isError, false);
  } finally {
    child.kill();
  }
});
