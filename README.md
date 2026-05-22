# Ollive Task

LLM inference logging and chat platform. A multi-service system that wraps LLM calls to capture latency, token usage, and errors with a real-time streaming chat interface

---

## Quick Start (Docker)

**Prerequisites:** Docker Desktop, an [OpenRouter](https://openrouter.ai) API key

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd ollive-task

# 2. Set up environment
cp .env.example .env
# Open .env and set OPENROUTER_API_KEY=sk-or-v1-...

# 3. Start everything
docker compose up --build
```

That's it. Docker Compose starts 5 containers in the correct order:

| Service | URL | What it does |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React chat UI |
| Chat API | http://localhost:3000 | Conversation + message management |
| Ingestion | http://localhost:3001 | Inference log ingestion + metrics |
| Postgres | localhost:5432 | Persistent storage |
| Migrate | (exits after run) | Runs DB migrations once on startup |

The migrate container runs SQL migrations and exits cleanly. The API and ingestion services only start after migrations complete (`depends_on: condition: service_completed_successfully`).

**Tear down (keeps data):**
```bash
docker compose down
```

**Tear down and wipe data:**
```bash
docker compose down -v
```

---

## Architecture Overview

```
Browser
  │
  └─ http://localhost:5173 (Vite dev server)
       │
       ├─ /api/ingest/*  ──────► Ingestion Service :3001
       ├─ /api/metrics/* ──────► Ingestion Service :3001
       └─ /api/*         ──────► Chat API :3000
                                    │
                                    ├─ PostgreSQL (conversations, messages)
                                    │
                                    └─ SDK Wrapper
                                         │
                                         ├─ OpenRouter (LLM provider)
                                         │    streams SSE → client
                                         │
                                         └─ fire-and-forget POST
                                              │
                                              └─ Ingestion Service :3001
                                                   │
                                                   └─ PostgreSQL (inference_logs)
```

### Services

**Chat Service (`services/chat`, port 3000)**
Manages conversations and messages. On each message, it:
1. Loads conversation history from Postgres
2. Calls the SDK wrapper with the LLM function
3. Streams SSE events (`content_delta`) to the browser as tokens arrive
4. Inserts the completed assistant message into Postgres

**Ingestion Service (`services/ingestion`, port 3001)**
Receives inference metadata from the SDK and writes it to `inference_logs`. Completely decoupled from the chat path and a failure here never affects the user. Also exposes three metrics endpoints (`/api/metrics/latency`, `/api/metrics/throughput`, `/api/metrics/errors`) that run SQL percentile queries directly on Postgres

**SDK (`sdk/`)**
An npm workspace package used by the chat service. The `wrap()` function:
- Calls the LLM via OpenRouter
- Records `ttfb_ms` (time to first token) on the first streamed chunk
- On completion, redacts PII from input/output previews and fires a log to the ingestion service (fire-and-forget)
- Returns the stream back to the caller

**Frontend (`frontend/`)**
React 18 + Vite + Tailwind

---

## Schema Design Decisions

### Why separate tables for conversations, messages, and inference_logs?

`conversations` and `messages` are **chat state** — they're read on every page load
`inference_logs` is **observability data**, it's written on every LLM call but only read by the metrics dashboard. Keeping them separate means heavy dashboard queries never block the chat path, and the logs table can be truncated or archived without touching conversations

### `inference_logs` references are `ON DELETE SET NULL`

Deleting a conversation nullifies `conversation_id` and `message_id` in `inference_logs` rather than cascading. This preserves the analytics record (latency, tokens, error rates) even after a user deletes their chat history.

### Partial index on inference_logs for latency queries

```sql
CREATE INDEX idx_inference_logs_latency ON inference_logs (provider, model, latency_ms)
  WHERE status = 'success';
```

Percentile queries (`PERCENTILE_CONT`) only make sense on successful calls. The `WHERE status = 'success'` filter makes this index smaller and faster — it never includes error or cancelled rows.

### `ingestion_dlq` table

If an inference log fails to insert (e.g. a constraint violation from a malformed payload), the raw JSON is written to `ingestion_dlq` instead of being lost. This is a safety net — the DLQ can be inspected and replayed manually, and it ensures a failed log write never surfaces as an error to the user.

---

## Tradeoffs

### No message queue — direct DB writes for ingestion

The ingestion path is synchronous: `POST /api/ingest/logs` → `INSERT INTO inference_logs` → `202`. This is simpler to operate (one fewer service) and fast enough for low volume use. The tradeoff: under high write load, ingestion could become a bottleneck. With a message queue (Redis, SQS, RabbitMQ), the SDK would enqueue a job and a worker would consume it, decoupling write latency from the HTTP response.

### OpenRouter instead of direct provider APIs

All LLM calls go through OpenRouter regardless of the chosen model. This means one API key, one SDK, and a single model string like `anthropic/claude-sonnet-4-5` routes correctly. The tradeoff is an extra network hop and dependency on OpenRouter's uptime. Direct provider clients would be faster and eliminate the middleman, but require separate SDKs and credentials per provider

### Vite dev server in production

The Docker image runs `vite dev --host` rather than building static files and serving them with nginx. This is simpler to deploy (no build step, no nginx config) and makes the k8s frontend container easy to update. For a production system with real traffic, a multi-stage Dockerfile (`vite build` → `nginx:alpine`) would be the right call.

---

## What We'd Improve With More Time

**Queue for ingestion**
Replace the synchronous HTTP call from the SDK with a queue. The SDK enqueues the log payload; a separate worker process consumes the queue and writes to Postgres. This decouples ingestion latency from the chat path entirely and provides natural backpressure under load.

**Authentication**
Currently there is no auth — anyone with the URL can use the chat. Adding JWT-based auth (sign up / sign in, token in Authorization header) would gate access and associate conversations with specific users.

**Static frontend build with nginx**
Multi-stage Dockerfile: `node:20-alpine` for `vite build`, then `nginx:alpine` to serve `dist/`. Reduces the frontend container from ~200MB RAM to ~20MB and improves first-load performance significantly.

**DLQ retry worker**
The `ingestion_dlq` table captures failed log writes but nothing retries them. A cron job or background worker that periodically scans `ingestion_dlq` and replays rows with `retry_count < 3` would close the loop on lost data.

**Grafana dashboards**
The three metrics endpoints (`/api/metrics/latency`, `/api/metrics/throughput`, `/api/metrics/errors`) return raw JSON. Wiring these into Grafana (or connecting Grafana directly to Postgres) would give time-series graphs, alerting thresholds, and drill-down by provider and model