import { Request, Response } from 'express';
import { validateInferenceLog } from '../schemas/inferenceLog.schema';
import { pool } from '../db';

export async function listLogs(req: Request, res: Response): Promise<void> {
  const limit = Math.min(100, parseInt((req.query.limit as string) || '50'));
  const { provider, status, conversation_id } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (provider)        { params.push(provider);        conditions.push(`provider = $${params.length}`); }
  if (status)          { params.push(status);          conditions.push(`status = $${params.length}`); }
  if (conversation_id) { params.push(conversation_id); conditions.push(`conversation_id = $${params.length}`); }

  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT * FROM inference_logs ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );

  res.json({ data: rows, count: rows.length });
}

export async function ingestLog(req: Request, res: Response): Promise<void> {
  const valid = validateInferenceLog(req.body);
  if (!valid) {
    res.status(400).json({ error: 'invalid payload', details: validateInferenceLog.errors });
    return;
  }

  const p = req.body;

  try {
    await pool.query(
      `INSERT INTO inference_logs (
        conversation_id, message_id, provider, model,
        latency_ms, ttfb_ms, prompt_tokens, completion_tokens, total_tokens,
        status, error_code, error_message,
        input_preview, output_preview, started_at, ended_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        p.conversation_id,
        p.message_id,
        p.provider,
        p.model,
        p.latency_ms,
        p.ttfb_ms,
        p.prompt_tokens,
        p.completion_tokens,
        p.total_tokens,
        p.status,
        p.error_code,
        p.error_message,
        p.input_preview,
        p.output_preview,
        p.started_at,
        p.ended_at,
      ]
    );

    res.status(202).json({ accepted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';

    // store in DLQ for manual inspection
    try {
      await pool.query(
        `INSERT INTO ingestion_dlq (payload, error_message) VALUES ($1, $2)`,
        [JSON.stringify(p), message]
      );
    } catch {
      // DLQ write failure is non-fatal
    }

    res.status(500).json({ error: 'ingestion failed' });
  }
}
