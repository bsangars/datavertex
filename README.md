# Agent Workspace

An MCP-style work agent with a transparent UI: it classifies a question, plans only the relevant approved tools, shows every call and result, synthesizes a sourced answer, and generates a short animated GIF briefing.

- **OpenAI routing:** when an API key is configured, the server uses OpenAI to pick tools and synthesize answers.
- **SQLite-backed tools:** Workday/HR, Sales CRM, Documents, Data Warehouse, and Knowledge tools run against a local SQLite database.
- **Generic workspace UI:** servers, tool counts, prompts, and policies are loaded from the API instead of hardcoded branding.
- **GIF output:** each completed answer can be downloaded as a real, two-frame animated `.gif` briefing without a third-party service.

## Run the app

```bash
cd /Users/bhargav/Documents/ChatGPT/dataavertex
node server/app.mjs
```

Open `http://localhost:4173`.

The app server serves the UI and API from one process. On first run it creates `data/vertex.db` from `data/seed.js`.

## Configure OpenAI

You can configure OpenAI in either place:

1. **Settings UI** (`#settings` in the app) — stores your API key in browser `localStorage`
2. **Server environment** — recommended for deployment

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini
node server/app.mjs
```

When OpenAI is configured, the flow is:

1. User asks a question
2. OpenAI selects relevant tools and arguments
3. The server executes those tools against SQLite
4. OpenAI synthesizes a sourced answer from the tool evidence

If no API key is available, the server falls back to deterministic regex routing.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Server and OpenAI config status |
| `/api/catalog` | GET | Workspace config, servers, tools, prompts |
| `/api/tools` | GET | Raw MCP tool definitions |
| `/api/tools/call` | POST | Execute one tool |
| `/api/agent/run` | POST | Plan, execute tools, synthesize answer |

Example:

```bash
curl -s http://localhost:4173/api/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is our sales pipeline summary?","settings":{"apiKey":"sk-..."}}'
```

## Run the MCP stdio server

In a separate terminal if you need stdio MCP transport:

```bash
node server/mcp-server.mjs
```

## Project structure

```text
data/
  seed.js         shared demo seed data
  vertex.db       local SQLite store (auto-created, gitignored)
server/
  app.mjs         UI + API server
  agent/          OpenAI planning, fallback routing, orchestration
  db/             SQLite schema, seeding, and query layer
  tools/          MCP tool definitions and handlers
src/
  api/            browser API client
  config/         client-side defaults
  data/           settings storage
  agent/          legacy browser fallback modules
  ui/             rendering and GIF export
tests/
```

## Tests

```bash
node --test tests/mcp-server.test.mjs
node --test tests/app-api.test.mjs
```

## Before connecting production systems

1. Authenticate each connector with least-privilege, read-only scopes.
2. Enforce employee/HR field policy before results reach the model.
3. Validate analytical queries against an allowlist or semantic metric layer—never expose arbitrary SQL to the model.
4. Require explicit user approval for writes, exports, or external side effects.
5. Persist the tool trace, arguments, citations, and answer for audit.

The MCP tool definitions follow the official `tools/list` and `tools/call` model. [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
