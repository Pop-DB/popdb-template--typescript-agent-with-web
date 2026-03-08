# PopDB TypeScript + React Template

## App Overview

This is the official PopDB template for TypeScript + React + Vite applications. It is cloned when users start a new PopDB webapp. It provides a minimal, working scaffold with a pre-built PopDB HTTP library and reliable environment configuration.

## Key Features

- PopDB HTTP client library (`src/lib/popdb.ts`) — auth and REST API with automatic token refresh
- Environment-based configuration via Vite modes (`.env.staging`, `.env.production`)
- Correct build scripts for staging and production that auto-load the right env

## Tech Stack

- React 19 + TypeScript
- Vite 6 (bundler)
- No CSS framework — plain CSS

## Project Structure

```
src/
  lib/
    popdb.ts      # PopDB HTTP library — auth, token management, REST fetch
  App.tsx         # Main app component (replace with your UI)
  App.css         # Minimal base styles
  main.tsx        # React entry point
  env.d.ts        # TypeScript types for import.meta.env (VITE_ vars)
.env.staging      # Staging environment config (MCP writes after clone)
.env.production   # Production environment config (MCP writes after clone)
```

## Development Commands

```bash
npm run dev              # Dev server in staging mode (port from $POP_DEV_PORT)
npm run build:staging    # TypeScript check + build with staging env
npm run build:production # TypeScript check + build with production env
npm run preview          # Preview last build locally
```

## Environment Configuration

After cloning, the PopDB MCP writes these files:

**`.env.staging`** and **`.env.production`**:
```
VITE_API_URL=      # PostgREST REST API URL
VITE_AUTH_URL=     # Auth API URL
VITE_ENVIRONMENT=  # staging | production
VITE_APP_ID=       # PopDB app ID
```

The correct file is auto-loaded by Vite based on the `--mode` flag. No manual switching needed.

## Using the PopDB Library

```ts
import { login, logout, apiFetch, getAccessToken } from "./lib/popdb";

// Auth
await login("user@example.com", "password");
logout();

// REST (PostgREST)
const todos = await apiFetch<Todo[]>("todos", {
  query: { order: "created_at.desc" },
});

const created = await apiFetch<Todo>("todos", {
  method: "POST",
  body: { title: "New todo", user_id: userId },
  prefer: "return=representation",
  single: true,
});

await apiFetch("todos", {
  method: "PATCH",
  query: { id: `eq.${id}` },
  body: { title: "Updated" },
});

await apiFetch("todos", {
  method: "DELETE",
  query: { id: `eq.${id}` },
});
```

The library automatically:
- Attaches `Authorization` and `x-popdb-environment` headers to every request
- Retries once on 401 after refreshing the access token
- Deduplicates concurrent refresh attempts

## PopDB Integration Patterns

1. **Server-side operations requiring secrets** (external API calls, email sending, AI processing) must use PopDB event handlers — never expose secrets in client code or VITE_* env vars.
2. **Non-secret config** like `VITE_API_URL` is fine in env files.
3. **API keys for integrations** are configured in the PopDB Admin UI, not in code.
4. **Third-party APIs** without a built-in integration: use `ctx.integrations.http` inside an event handler.
5. **Never create a separate backend/proxy server** — PopDB event handlers are the server-side layer.

## Updating This File

Update this CLAUDE.md when:
- New major dependencies are added
- The project structure changes significantly
- New PopDB features or patterns are adopted
- The build or dev workflow changes
