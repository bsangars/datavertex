import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const dbPath = join(process.cwd(), 'data', 'vertex.db');
const port = 4317;

function startApp() {
  const child = spawn(process.execPath, ['server/app.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return child;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start');
}

test('the app API plans, runs tools, and returns an answer', async () => {
  try { unlinkSync(dbPath); } catch {}
  const child = startApp();
  try {
    await waitForServer();
    const catalog = await fetch(`http://127.0.0.1:${port}/api/catalog`).then(response => response.json());
    assert.equal(catalog.toolCount, 8);
    assert.ok(catalog.servers.length >= 5);

    const output = await fetch(`http://127.0.0.1:${port}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Who is starting in the next 30 days?' })
    }).then(response => response.json());

    assert.equal(output.mode, 'fallback');
    assert.ok(output.plan.length >= 1);
    assert.ok(output.answer.title);
    assert.match(output.plan[0].name, /^workday\./);

    const employees = await fetch(`http://127.0.0.1:${port}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'who are the employee list' })
    }).then(response => response.json());

    assert.ok(employees.answer.body.includes('Avery Chen'));
    assert.ok(employees.answer.body.includes('Jordan Lee'));
    assert.equal(employees.plan[0].structuredResult.count, 12);
  } finally {
    child.kill();
  }
});
