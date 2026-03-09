# PopDB Agent + Web Template

## App Overview

<!-- Describe what this agent does, what problem it solves, and any key workflows. -->

## What is PopDB?

PopDB is a managed backend platform providing PostgreSQL, authentication, a PostgREST REST API, event handlers (the "agent runtime"), cron triggers, and webhooks.

This is an **agent-mode app with a web UI**: a single admin user, server-side event handlers for automations and integrations, AND a React frontend for dashboards, monitoring, or configuration. No public signup — the admin logs in to the web UI, and event handlers run in the background.

## Tech Stack

- React 19 + TypeScript (frontend)
- Vite 6 (bundler, mode-based env loading)
- PopDB event handlers (server-side TypeScript in Docker containers)
- No CSS framework — plain CSS

## Project Structure

```
src/                         # React frontend
  lib/
    popdb.ts                 # PopDB HTTP library — auth, token management, REST fetch, query helpers
  App.tsx                    # Main app component (replace with your UI)
  App.css                    # Minimal base styles
  main.tsx                   # React entry point + env validation
  env.d.ts                   # TypeScript types for import.meta.env (VITE_ vars)
handlers/                    # Server-side event handlers
  on-task-created.ts         # Example handler stub
popdb.config.ts              # Event types + handler registration
.env.staging                 # Staging environment config (MCP writes after setup)
.env.production              # Production environment config (MCP writes after setup)
```

## PopDB App Info

<!-- Filled by MCP after create_database -->
<!--
App ID:
Staging DB ID:
Production DB ID:
-->

## Development Commands

```bash
npm run dev              # Dev server in staging mode (port from $POP_DEV_PORT)
npm run build:staging    # TypeScript check + build with staging env
npm run build:production # TypeScript check + build with production env
```

**Workflow**: After making changes, build with `npm run build:staging` and deploy to PopDB staging hosting to test. Use `npm run dev` only for rapid local iteration.

## Deployment Workflow

### Initial Setup
1. **Create the app**: `create_database` with `mode: "agent"`
2. **Set admin password**: `setup_app_password` (admin user is auto-created)
3. **Define schema**: `stage_change` + `apply_changes` for each table
4. **Start the API**: `start_postgrest`

### Deploy Event Handlers
5. **Deploy handlers**: `deploy_event_app` with the project directory
6. **Start the runtime**: `start_event_runtime`
7. **Add triggers**: `create_cron_trigger` for scheduled events, `create_webhook` for external integrations
8. **Test**: `emit_test_event` to trigger handlers manually

### Deploy Frontend
9. **Build**: `npm run build:staging`
10. **Deploy**: `deploy_app` with the `dist` directory
11. **Share**: the staging URL is live immediately

## Environment Configuration

After setup, the PopDB MCP writes `.env.staging` and `.env.production` with `VITE_API_URL`, `VITE_AUTH_URL`, `VITE_ENVIRONMENT`, and `VITE_APP_ID`. Vite auto-loads the correct file based on the `--mode` flag. The app throws at startup if any are missing.

## PopDB Library (`src/lib/popdb.ts`)

Pre-built helpers — read the file for full details:

- **Auth**: `login`, `register`, `logout`, `getMe`, `refreshSession`
- **Token management**: `getAccessToken`, `clearTokens`, etc. (localStorage)
- **REST**: `apiFetch<T>(path, options)` — auto-attaches auth + environment headers, handles 401 with token refresh, supports `limit`, `offset`, `single`, `prefer`
- **PostgREST query helpers**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in_`, `isNull`, `isNotNull`, `like`, `ilike`, `match`, `imatch`, `fts`, `contains`, `containedBy`, `not`, `or`
- **Aggregate helpers**: `count`, `sum`, `avg`, `min`, `max` — use with caution, ensure indexed columns; server max is 1,000 rows per request

## PopDB Integration Patterns

1. **Server-side operations requiring secrets** (external API calls, email, AI) must use PopDB event handlers — never expose secrets in client code or `VITE_*` env vars.
2. **Non-secret config** like `VITE_API_URL` is fine in env files.
3. **API keys for integrations** are configured in the PopDB Admin UI, not in code.
4. **Third-party APIs** without a built-in integration: use `ctx.integrations.http` inside an event handler.
5. **Never create a separate backend/proxy server** — PopDB event handlers are the server-side layer.

## Event Handler SDK

Every handler is a default-exported async function that receives an `event` and a `ctx` (context) object:

```typescript
export default async function (event, ctx) {
  const { payload } = event;
  // handler logic
}
```

### ctx.emit(eventType, payload)

Emit a new event into the pipeline. Downstream handlers listening to that event type will process it.

```typescript
await ctx.emit('lead.qualified', { email: 'jane@acme.com', score: 85 });
```

### ctx.log

Structured logging visible in handler execution logs.

```typescript
ctx.log.info('Processing started', { id: event.payload.id });
ctx.log.warn('Missing field', { field: 'email' });
ctx.log.error('API call failed', { status: 500 });
```

#### ctx.log.step(name, data?)

Record a named step in the execution trace. Use for lightweight visibility without splitting into separate handlers.

```typescript
const enriched = await ctx.integrations.apollo.enrich({ email });
ctx.log.step('Apollo enrichment', { title: enriched.person?.title });

const score = await ctx.ai.extract(text, schema);
ctx.log.step('AI scoring', { tier: score.tier });
```

### ctx.state

Redis-backed key-value state. Persists across handler executions.

```typescript
await ctx.state.set('last_run', new Date().toISOString());
await ctx.state.set('cache:user:123', userData, 3600); // TTL in seconds

const value = await ctx.state.get('last_run');
const count = await ctx.state.increment('processed_count');
const newCount = await ctx.state.increment('score', 5); // increment by 5
await ctx.state.delete('cache:user:123');
```

### ctx.ai.generate(prompt, options?)

Generate text with an LLM.

```typescript
const result = await ctx.ai.generate('Summarize this email for a sales team.', {
  system: 'You are a sales assistant.',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 500,
  temperature: 0.7,
});
// result is the generated text string
```

### ctx.ai.extract(input, schema, options?)

Extract structured data from text using a JSON Schema.

```typescript
const data = await ctx.ai.extract(emailBody, {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
    topics: { type: 'array', items: { type: 'string' } },
    urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['sentiment', 'urgency'],
});
// data = { sentiment: 'positive', topics: ['pricing', 'demo'], urgency: 'medium' }
```

### ctx.ai.analyzeAndRoute(input, options)

LLM picks which event to emit and generates a structured payload in a single call. This replaces the pattern of "classify with one LLM call, then extract with another."

```typescript
const decision = await ctx.ai.analyzeAndRoute(emailBody, {
  instructions: 'Classify this inbound email and extract relevant data.',
  temperature: 0,
  fallbackEvent: 'email.unclassified',
  routes: {
    'lead.new': {
      description: 'A potential customer asking about the product or pricing',
      schema: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          interest: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['priority'],
      },
    },
    'support.ticket': {
      description: 'An existing customer reporting a bug or requesting help',
      schema: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'normal', 'low'] },
        },
        required: ['issue', 'severity'],
      },
    },
  },
});

// decision = { event: 'lead.new', payload: { company: 'Acme', ... }, metadata: { model, candidates } }
await ctx.emit(decision.event, decision.payload);
```

**Route design tips:**
- Write clear descriptions — the LLM uses them to decide
- Use enums for constrained values
- Set `temperature: 0` for deterministic routing
- Always set `fallbackEvent` for production

### ctx.exec(command, args, options?)

Run CLI commands in the handler container. Use `systemPackages` in popdb.config.ts to install tools like ffmpeg or imagemagick.

```typescript
const result = await ctx.exec('ffmpeg', ['-i', inputPath, '-vf', 'scale=320:240', outputPath]);
// result = { stdout, stderr, exitCode }
```

### ctx.integrations

Access configured integrations. Secrets are set in the PopDB Admin UI, never in code.

```typescript
// Slack
await ctx.integrations.slack.postMessage({
  channel: '#alerts',
  text: 'New lead from Acme Corp!',
});

// Email (AWS SES)
await ctx.integrations.email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome!</h1>',
});

// HTTP (always available — call any external API)
const response = await ctx.integrations.http.post('https://api.example.com/webhook', {
  body: { data: event.payload },
});

// Apollo.io (person enrichment)
const enriched = await ctx.integrations.apollo.enrich({
  email: 'jane@acme.com',
  first_name: 'Jane',
  last_name: 'Doe',
});

// Bland.ai (AI phone calls)
const call = await ctx.integrations.bland.call({
  phone_number: '+15551234567',
  task: 'Introduce yourself and ask about their needs.',
  first_sentence: 'Hi, this is Alex from Acme!',
});

// Gmail
const inbox = await ctx.integrations.gmail.listMessages({ q: 'is:unread', maxResults: 10 });
await ctx.integrations.gmail.sendMessage({ to: 'user@example.com', subject: 'Hello', body: 'Hi!' });
```

### ctx.db

Query the app's PostgreSQL database via PostgREST. In agent-mode handlers, `ctx.db` uses the service role with full access.

```typescript
// Query
const rows = await ctx.db.query('leads', {
  filter: { status: 'eq.new', score: 'gte.80' },
  select: 'id,email,score',
  order: 'created_at.desc',
  limit: 10,
});

// Insert (single row)
const [lead] = await ctx.db.insert('leads', { email: 'jane@acme.com', status: 'new' });

// Insert (multiple rows)
const rows = await ctx.db.insert('logs', [
  { message: 'Step 1 complete' },
  { message: 'Step 2 complete' },
]);

// Update (requires filter)
await ctx.db.update('leads', { id: `eq.${leadId}` }, { status: 'qualified' });

// Delete (requires filter)
await ctx.db.delete('leads', { status: 'eq.spam' });
```

**PostgREST filter syntax:** `eq.value`, `neq.value`, `gt.100`, `gte.100`, `lt.50`, `lte.50`, `in.(a,b,c)`, `is.null`, `like.*pattern*`, `ilike.*pattern*`

## popdb.config.ts Reference

```typescript
export default {
  // Optional: system packages to install in the handler Docker image
  systemPackages: ['ffmpeg', 'imagemagick'],

  eventTypes: {
    'event.name': {
      displayName: 'Human Readable Name',
      // Optional JSON Schema for payload validation (rejects invalid payloads with 400)
      schema: {
        type: 'object',
        properties: {
          field: { type: 'string' },
        },
        required: ['field'],
      },
    },
  },

  handlers: {
    'handler-name': {
      file: './handlers/handler-file.ts',  // relative path to handler
      listensTo: ['event.name'],            // events this handler processes
      emits: ['other.event'],               // events this handler may emit (documentation only)
      concurrency: 5,                       // max concurrent executions (default: 1)
      timeout: 30000,                       // ms before timeout (default: 30000)
      maxRetries: 3,                        // retry attempts on failure (default: 3)
      retryDelay: 1000,                     // base retry delay in ms, doubles each attempt (default: 1000)
    },
  },
};
```

## Available Integrations

Integrations are enabled in the PopDB Admin UI. API keys and secrets are configured there, never in code. After enabling an integration, use the `get_api_endpoints` MCP tool (pass the staging database_id) for full SDK documentation and code examples.

| Category | Examples |
|----------|----------|
| AI / LLMs | Anthropic, OpenAI, Google AI |
| Communication | Slack, Discord, Microsoft Teams, Telegram, WhatsApp, Intercom |
| Email / Marketing | SendGrid, Gmail, AWS SES, Mailchimp, Klaviyo, ConvertKit |
| CRM / Sales | HubSpot, Salesforce, Apollo.io, Pipedrive, Zoho CRM |
| E-commerce | Shopify, Stripe, Square, WooCommerce, BigCommerce |
| Payments / Finance | Stripe, PayPal, Plaid, QuickBooks, Xero |
| Project Management | Linear, Asana, Notion, Trello, Monday, ClickUp |
| Scheduling | Calendly, Google Calendar, Outlook Calendar, Zoom |
| Analytics | Amplitude, Mixpanel, Google Analytics, Hotjar |
| Storage / Files | AWS S3, Cloudinary, Dropbox, Google Drive |
| Social Media | Twitter/X, LinkedIn, Instagram, YouTube |
| Shipping | EasyPost, Shippo, ShipStation |
| Phone / Voice | Bland.ai |
| HTTP | Always available — call any external API via `ctx.integrations.http` |

## Database Patterns

This is a hybrid agent + web app. Choose the right access pattern per table:

- **`access: "internal"`** — Tables only event handlers need (logs, job state, raw data). Accessible to handlers (service role) and admin, not to anonymous users.
- **`access: "admin_managed"`** — Tables the web UI reads but only handlers/admin write. Good for dashboards displaying processed data.
- **`access: "open"`** — Tables the web UI reads AND writes directly. Use sparingly.

Since this is agent-mode (single admin user), you don't need `user_id` columns or `owner` access patterns.

```
stage_change({
  database_id: "app-name",
  operation: "CREATE_TABLE",
  params: {
    tableName: "leads",
    columns: [
      { name: "id", type: "uuid", primaryKey: true, defaultValue: "uuid_generate_v4()" },
      { name: "email", type: "text", nullable: false },
      { name: "status", type: "text", defaultValue: "'new'" },
      { name: "score", type: "integer" },
      { name: "data", type: "jsonb" },
      { name: "created_at", type: "timestamptz", defaultValue: "now()" }
    ],
    access: "internal"
  }
})
```

## Idempotency Pattern

For production workflows, prevent duplicate processing:

```typescript
export default async function (event, ctx) {
  const key = event.payload.idempotencyKey;
  if (key) {
    const processed = await ctx.state.get(`done:${key}`);
    if (processed) return;
  }

  // ... handler logic ...

  if (key) {
    await ctx.state.set(`done:${key}`, true, 86400); // expire after 24h
  }
}
```

## Multi-Handler Pipeline Pattern

Split complex workflows into focused handlers connected by events:

```
inbound.received
  -> [classify] -> lead.qualified / support.ticket / spam.detected
    -> [handle-lead] -> notification.send
    -> [handle-support] -> ticket.created
```

Each step retries independently, can have its own concurrency, and shows as a separate node in execution traces.

## Updating This File

Update this CLAUDE.md when:
- New event types or handlers are added
- The database schema changes significantly
- New integrations are enabled
- New major dependencies are added
- The project structure changes significantly
- The deployment workflow changes
