#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgent } from './agent/run.mjs';
import { buildWorkspaceConfig } from './catalog-ui.mjs';
import { tools } from './tools/catalog.mjs';
import { runTool } from './tools/handlers.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  const content = await readFile(filePath);
  const type = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': type });
  response.end(content);
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/catalog') {
    sendJson(response, 200, buildWorkspaceConfig());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/tools') {
    sendJson(response, 200, { tools });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/tools/call') {
    const body = await readBody(request);
    const result = runTool(body.name, body.arguments || {});
    if (!result) {
      sendJson(response, 400, { error: `Unknown tool: ${body.name}` });
      return;
    }
    sendJson(response, 200, { result });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/agent/run') {
    const body = await readBody(request);
    const output = await runAgent(body.question, body.settings || {});
    sendJson(response, 200, output);
    return;
  }

  sendJson(response, 404, { error: 'API route not found' });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Agent server running at http://localhost:${port}`);
});
