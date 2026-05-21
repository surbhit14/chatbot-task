CREATE TABLE IF NOT EXISTS ingestion_dlq (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload       JSONB NOT NULL,
  error_message TEXT,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_tried_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_created_at ON ingestion_dlq (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_retry      ON ingestion_dlq (retry_count, last_tried_at);
