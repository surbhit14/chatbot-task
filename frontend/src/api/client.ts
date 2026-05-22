import { Conversation, ConversationDetail } from '../types';

const BASE = '';

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/api/conversations?limit=50`);
  if (!res.ok) throw new Error('Failed to load conversations');
  const json = await res.json();
  return json.data as Conversation[];
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${BASE}/api/conversations/${id}`);
  if (!res.ok) throw new Error('Failed to load conversation');
  return res.json();
}

export async function createConversation(title?: string): Promise<Conversation> {
  const res = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title ?? 'New Chat' }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function cancelConversation(id: string): Promise<Conversation> {
  const res = await fetch(`${BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!res.ok) throw new Error('Failed to cancel conversation');
  return res.json();
}

export async function streamMessage(
  conversationId: string,
  content: string,
  onDelta: (delta: string) => void,
  signal: AbortSignal,
  model?: string
): Promise<void> {
  const res = await fetch(`${BASE}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...(model ? { model } : {}) }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by double newline
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.trim()) continue;

      let eventType = '';
      let dataLine = '';

      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }

      if (eventType === 'content_delta') {
        try {
          const parsed = JSON.parse(dataLine) as { delta: string };
          onDelta(parsed.delta);
        } catch {
          // malformed chunk — skip
        }
      }

      if (eventType === 'done' || dataLine === '[DONE]') {
        return;
      }

      if (eventType === 'error') {
        throw new Error('Stream error from server');
      }
    }
  }
}

// ── Ingestion / Dashboard ────────────────────────────────────────────────────

export interface InferenceLog {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  provider: string;
  model: string;
  latency_ms: number | null;
  ttfb_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  status: 'success' | 'error' | 'cancelled';
  error_code: string | null;
  error_message: string | null;
  input_preview: string | null;
  output_preview: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export async function listInferenceLogs(params?: {
  provider?: string;
  status?: string;
  conversation_id?: string;
  limit?: number;
}): Promise<{ data: InferenceLog[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.provider) qs.set('provider', params.provider);
  if (params?.status) qs.set('status', params.status);
  if (params?.conversation_id) qs.set('conversation_id', params.conversation_id);
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${BASE}/api/ingest/logs?${qs}`);
  if (!res.ok) throw new Error('Failed to load logs');
  return res.json();
}

export interface LatencyMetrics {
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  sample_count: number;
  provider: string | null;
  model: string | null;
}

export async function getMetricsLatency(params?: {
  provider?: string;
  model?: string;
  from?: string;
  to?: string;
}): Promise<LatencyMetrics> {
  const qs = new URLSearchParams();
  if (params?.provider) qs.set('provider', params.provider);
  if (params?.model) qs.set('model', params.model);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const res = await fetch(`${BASE}/api/metrics/latency?${qs}`);
  if (!res.ok) throw new Error('Failed to load latency metrics');
  return res.json();
}

export interface ThroughputBucket {
  timestamp: string;
  request_count: number;
}

export async function getMetricsThroughput(params?: {
  granularity?: 'hour' | 'minute';
  from?: string;
  to?: string;
}): Promise<{ granularity: string; buckets: ThroughputBucket[] }> {
  const qs = new URLSearchParams();
  if (params?.granularity) qs.set('granularity', params.granularity);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const res = await fetch(`${BASE}/api/metrics/throughput?${qs}`);
  if (!res.ok) throw new Error('Failed to load throughput metrics');
  return res.json();
}

export interface ErrorRow {
  provider: string;
  model: string;
  error_code: string | null;
  count: number;
  error_rate_pct: number;
}

export async function getMetricsErrors(params?: {
  provider?: string;
  from?: string;
  to?: string;
}): Promise<{ data: ErrorRow[] }> {
  const qs = new URLSearchParams();
  if (params?.provider) qs.set('provider', params.provider);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const res = await fetch(`${BASE}/api/metrics/errors?${qs}`);
  if (!res.ok) throw new Error('Failed to load error metrics');
  return res.json();
}
