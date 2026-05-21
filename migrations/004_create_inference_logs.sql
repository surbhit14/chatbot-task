CREATE TYPE inference_status AS ENUM ('success', 'error', 'cancelled');

CREATE TABLE IF NOT EXISTS inference_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id        UUID REFERENCES messages(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  latency_ms        INTEGER,
  ttfb_ms           INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  status            inference_status NOT NULL,
  error_code        TEXT,
  error_message     TEXT,
  input_preview     TEXT,
  output_preview    TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inference_logs_conversation_id ON inference_logs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_inference_logs_provider_model  ON inference_logs (provider, model);
CREATE INDEX IF NOT EXISTS idx_inference_logs_status          ON inference_logs (status);
CREATE INDEX IF NOT EXISTS idx_inference_logs_started_at      ON inference_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_logs_latency         ON inference_logs (provider, model, latency_ms)
  WHERE status = 'success';
