# Vertex Agent

An MCP-style work agent with a transparent UI: it classifies a question, plans only the relevant approved tools, shows every call and result, synthesizes a sourced answer, and generates a short animated GIF briefing.

- **Workday / HR:** worker search and onboarding status.
- **Documents:** approved document search and citations.
- **Data / RDBMS:** validated read-only analytical queries and metric definitions.
- **Articles:** company knowledge and policy lookup.
- **GIF output:** each completed answer can be downloaded as a real, two-frame animated `.gif` briefing without a third-party service.

## Run the UI

```bash
cd /Users/bhargav/Documents/ChatGPT/dataavertex
python3 -m http.server 4173
```

Open `http://localhost:4173` and choose a sample prompt or ask your own. The current UI runs mock **read-only** responses, so it is safe to explore without business credentials.

## Run the MCP demo server

In a second terminal:

```bash
node server/mcp-server.mjs
```

The stdio server implements `initialize`, `tools/list`, and `tools/call` with the tool definitions used in the UI. It uses the 2026-07-28 MCP protocol shape and intentionally returns mock data only. The UI simulates that transport in the browser so it remains dependency-free; replace the demo adapter with a backend MCP client when connecting real systems.

## Project structure

```text
src/
  agent/        question routing and answer synthesis
  data/         shared UI tool catalog
  ui/           UI rendering and GIF export
  styles/       application styling
server/
  tools/        MCP tool definitions and demo handlers
tests/          protocol-level server tests
```

## Before connecting production systems

1. Authenticate each connector with least-privilege, read-only scopes.
2. Enforce employee/HR field policy before results reach the model.
3. Validate analytical queries against an allowlist or semantic metric layer—never expose arbitrary SQL to the model.
4. Require explicit user approval for writes, exports, or external side effects.
5. Persist the tool trace, arguments, citations, and answer for audit.

The MCP tool definitions follow the official `tools/list` and `tools/call` model. [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
