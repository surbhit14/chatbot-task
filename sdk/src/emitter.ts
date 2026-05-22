import { InferenceLogPayload } from './types';

const INGESTION_URL = process.env.INGESTION_URL || 'http://localhost:3001';
const EMIT_TIMEOUT_MS = parseInt(process.env.SDK_EMIT_TIMEOUT_MS || '5000');

export async function emitLog(payload: InferenceLogPayload): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMIT_TIMEOUT_MS);

  try {
    await fetch(`${INGESTION_URL}/api/ingest/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // fire-and-forget: swallow errors so ingestion never blocks the chat response
  } finally {
    clearTimeout(timer);
  }
}
