# PopDB Agent + Web Template

Build AI agents and automations with a web dashboard using [PopDB](https://popdb.dev).

## What's Included

- **src/** — React + TypeScript + Vite frontend with pre-built PopDB auth and API client
- **handlers/** — Server-side TypeScript event handlers with AI, integrations, and database access
- **popdb.config.ts** — Event types and handler definitions
- **CLAUDE.md** — Comprehensive SDK reference for Claude Code

## Quick Start

### Prerequisites

- [Claude Code](https://claude.ai/code) with the PopDB MCP server configured

### 1. Clone the template

```bash
npx degit Pop-DB/popdb-template--typescript-agent-with-web my-app
cd my-app
npm install
```

### 2. Open in Claude Code and describe what you want to build

Claude Code will:
- Create a PopDB agent app with a web UI
- Set up your admin password
- Design your database schema
- Build your React frontend
- Write event handlers
- Deploy everything

## How It Works

```
Web UI (React) → PostgREST API → PostgreSQL ← Event Handlers
                                      ↑
                            Cron / Webhooks / Events
```

The web frontend reads and writes data through PopDB's REST API. Event handlers run server-side in Docker containers, processing events and calling external services. Both share the same database.

See [CLAUDE.md](./CLAUDE.md) for the full SDK reference.
