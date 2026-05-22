export type InferenceStatus = 'success' | 'error' | 'cancelled';

export interface InferenceLogPayload {
  provider: string;
  model: string;
  conversation_id: string | null;
  message_id: string | null;
  latency_ms: number | null;
  ttfb_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  status: InferenceStatus;
  error_code: string | null;
  error_message: string | null;
  input_preview: string | null;
  output_preview: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface WrapOptions {
  provider: string;
  model: string;
  conversation_id?: string | null;
  message_id?: string | null;
  input: string;
}

export interface WrapResult {
  text: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  ttfb_ms: number | null;
  latency_ms: number;
}

export type ChunkCallback = (delta: string) => void;
