CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT NOT NULL,
  sequence_num    INTEGER NOT NULL,
  provider        TEXT,
  model           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_messages_sequence UNIQUE (conversation_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id, sequence_num ASC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_model  ON messages (provider, model);
