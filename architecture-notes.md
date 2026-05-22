# Architecture Notes — Ollive

**Project:** LLM Inference Logging & Chat Platform
**Stack:** TypeScript · Node.js · Express · PostgreSQL · React · Docker

---

## 1. Ingestion Flow

The ingestion flow is the path from an LLM call completing to metadata being stored in the database. It is intentionally decoupled from the chat path so that logging never blocks or degrades the user experience.

### Step-by-step

1. **User sends a message** → Chat Service receives `POST /api/conversations/:id/messages`
2. **SDK wrapper is invoked** — `sdk.wrap()` opens a streaming connection to OpenRouter (unified LLM gateway)
3. **Streaming begins** — tokens flow from OpenRouter → Chat Service → SSE stream → browser in real time. The SDK records `ttfb_ms` (time to first token) when the first chunk arrives.
4. **Stream completes** — the SDK computes `latency_ms`, collects token counts from the response metadata, and assembles the inference log payload
5. **PII redaction** — before the payload leaves the process, the SDK runs regex patterns over the input and output preview fields, replacing emails, phone numbers, SSNs, and credit card numbers with `[EMAIL]`, `[PHONE]`, and `[CARD]`
6. **Fire-and-forget emit** — the SDK fires a `POST /api/ingest/logs` to the Ingestion Service with a 5-second timeout. This call is asynchronous — the chat response does not wait for it
7. **Ingestion Service receives the payload** → validates with Ajv JSON schema → `INSERT INTO inference_logs`
8. **On INSERT failure** → payload is written to `ingestion_dlq` (dead letter queue) instead of being lost
9. **Response:** `202 Accepted` — the Ingestion Service never returns an error to the caller that would surface to the user

### Flow Diagram

```
User Message
    │
    ▼
Chat Service
    │── loads history from Postgres
    │── inserts user message
    │── sets SSE headers
    │
    ▼
SDK Wrapper ──────────────────────────────────────────────────────────┐
    │                                                                  │
    │── calls OpenRouter                                               │
    │── records ttfb_ms on first chunk                                 │
    │── yields chunks → SSE stream → browser                          │
    │── on complete: computes latency_ms, redacts PII                 │
    │                                                                  │
    └── fire-and-forget POST /api/ingest/logs ──────────────────────► Ingestion Service
                                                                       │── validates schema
Chat Service (continues)                                               │── INSERT inference_logs
    │── inserts assistant message                                      └── on fail → DLQ
    │── sends SSE: message_end, done
    └── closes connection
```

---

## 2. Logging Strategy

### What is logged

Every LLM call produces one row in `inference_logs`. The row contains:

| Field | Description |
|-------|-------------|
| `provider` | LLM provider (e.g. `openai`, `anthropic`) |
| `model` | Model identifier (e.g. `openai/gpt-4o`) |
| `latency_ms` | Total time from request start to stream end |
| `ttfb_ms` | Time to first token — measures streaming responsiveness |
| `prompt_tokens` | Tokens in the input |
| `completion_tokens` | Tokens in the output |
| `total_tokens` | Sum of prompt + completion |
| `status` | `success`, `error`, or `cancelled` |
| `error_code` | Provider error code, if applicable |
| `error_message` | Human-readable error, if applicable |
| `input_preview` | First 200 chars of input, PII-redacted |
| `output_preview` | First 200 chars of output, PII-redacted |
| `started_at` / `ended_at` | Timestamps for time-range queries |

### What is not logged

Full message content is stored in the `messages` table (owned by the Chat Service), not duplicated into `inference_logs`. The logs table holds observability data only — it can be truncated or archived without affecting conversations.

### PII Redaction

Applied at the SDK level before the payload leaves the Chat Service process. Four patterns, applied in order:

| Pattern | Replacement |
|---------|-------------|
| Email addresses | `[EMAIL]` |
| US phone numbers | `[PHONE]` |
| Credit card numbers | `[CARD]` |

Redaction is a hard boundary and no PII can reach the Ingestion Service or the database.

### Why a separate `ingestion_dlq` table

If an `INSERT INTO inference_logs` fails (schema mismatch, constraint violation, disk error), the raw payload is written to `ingestion_dlq` with the error message. This ensures:

- No log is silently lost
- The failure is observable (DLQ row count is a useful alert metric)
- Rows can be inspected and replayed manually once the root cause is fixed

### Metrics available

The Ingestion Service exposes three query endpoints backed directly by SQL on PostgreSQL — no separate metrics store:

| Endpoint | SQL feature used | What it returns |
|----------|-----------------|-----------------|
| `GET /api/metrics/latency` | `PERCENTILE_CONT` | p50, p95, p99 latency per provider/model |
| `GET /api/metrics/throughput` | `date_trunc` + `COUNT` | Requests per hour/minute over a time range |
| `GET /api/metrics/errors` | `COUNT` + `FILTER` | Error count and rate % by provider, model, error code |

A **partial index** on `inference_logs` drives the latency queries efficiently:

```sql
CREATE INDEX idx_inference_logs_latency
  ON inference_logs (provider, model, latency_ms)
  WHERE status = 'success';
```

This index only covers successful calls — the only rows where latency percentiles are meaningful

---

## 3. Scaling Considerations

### What scales horizontally today

Both the Chat Service and Ingestion Service are **stateless** — they hold no in-memory state between requests. Each request reads from and writes to Postgres independently. Running multiple replicas behind a load balancer works without any application-level changes.

### Current bottleneck: synchronous ingestion writes

The SDK fires a synchronous HTTP POST to the Ingestion Service after each LLM call. The Ingestion Service then performs a synchronous `INSERT`. Under high request volume, this creates:

- Write pressure on Postgres (`inference_logs` gets a row per LLM call)
- Latency coupling: if Postgres is slow, the 5-second SDK timeout delays chat response completion

**The fix:** Replace the synchronous HTTP call with a **message queue** (Redis Streams, AWS SQS, RabbitMQ). The SDK enqueues a payload in microseconds. A separate worker process consumes jobs from the queue at a controlled rate and writes to Postgres. The chat path never waits for the write.

### Database connection limits

Postgres is configured with `max_connections = 20`. Each service holds a small connection pool. Scaling beyond 3–4 replicas per service would exhaust this budget.

**The fix:** Add **PgBouncer** in transaction-pooling mode. PgBouncer multiplexes many application connections onto a small number of actual Postgres connections — 20 real connections can support hundreds of application replicas.

### `inference_logs` table growth

The table grows with every LLM call and has no retention policy. At scale:

- Query performance degrades as the table grows (even with indexes)
- Storage costs increase

**The fix:** Partition the table by month using `PARTITION BY RANGE (created_at)`. Old partitions can be archived or dropped without touching recent data. Queries that filter by `started_at` only scan the relevant partition.

### Frontend scaling

The current deployment runs the **Vite development server** as the production frontend — a Node.js process that compiles TypeScript on the fly. This uses ~200MB RAM per instance and is single-threaded.

**The fix:** Multi-stage Docker build — `vite build` produces a static `dist/` folder, then `nginx:alpine` serves it. The resulting container uses ~20MB RAM, serves thousands of requests per second per instance, and scales to any number of replicas.

---

## 4. Failure Handling Assumptions

### Ingestion failure is non-fatal

The SDK uses fire-and-forget with a 5-second timeout. If the Ingestion Service is unreachable or returns an error, the chat response still completes normally. The user is never aware of a logging failure. This is an explicit product decision: **observability must never degrade the user experience**.

Failed payloads that reach the Ingestion Service but fail the DB write are captured in `ingestion_dlq` for manual review. Failed HTTP calls from the SDK (timeout or network error) are currently lost — a known gap.

### LLM API errors are captured, not surfaced as crashes

If OpenRouter returns an error during streaming, the SDK catches it and:

1. Records `status = 'error'` with `error_code` and `error_message` in the inference log
2. Emits the log payload to the Ingestion Service (fire-and-forget)
3. Propagates the error back to the Chat Service via the SSE `error` event

The conversation is not automatically marked failed, the application surfaces the error message to the user and allows them to retry.

### Postgres unavailability

There is no circuit-breaker or retry logic at the application level. If Postgres is unavailable:

- Chat Service returns `500` for all new requests
- Ingestion Service returns `500`, triggering SDK timeout
- Existing SSE streams continue until the next DB write attempt, then fail


### Migration safety

The migration script (`scripts/migrate.js`) tracks applied migrations in a `schema_migrations` table.

---

## 5. What I Can Improve With More Time

| Improvement | Why |
|-------------|-----|
| **Message queue for ingestion** | Decouple write latency from chat path; absorb traffic spikes; enable automatic retry |
| **Authentication (JWT)** | Gate access; associate conversations with specific users; prevent unauthorized use |
| **Static frontend build (nginx)** | Reduce memory from 200MB to 20MB; improve first-load performance |
| **DLQ retry worker** | Automatically replay failed ingestion rows instead of requiring manual intervention |
| **Grafana dashboards** | Visualise latency/throughput/error metrics with time-series graphs and alerting |
| **PgBouncer** | Allow horizontal scaling of services without exhausting Postgres connection limit |
| **Table partitioning** | Keep `inference_logs` query performance stable as data volume grows |
