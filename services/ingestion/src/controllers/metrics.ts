import { Request, Response } from 'express';
import { pool } from '../db';

export async function getLatency(req: Request, res: Response): Promise<void> {
  const { provider, model, from, to } = req.query as Record<string, string>;

  const conditions: string[] = ["status = 'success'"];
  const params: unknown[] = [];

  if (provider) { params.push(provider); conditions.push(`provider = $${params.length}`); }
  if (model)    { params.push(model);    conditions.push(`model = $${params.length}`); }
  if (from)     { params.push(from);     conditions.push(`started_at >= $${params.length}`); }
  if (to)       { params.push(to);       conditions.push(`started_at <= $${params.length}`); }

  const where = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_ms,
      COUNT(*) AS sample_count
    FROM inference_logs
    WHERE ${where}`,
    params
  );

  res.json({ ...rows[0], provider: provider ?? null, model: model ?? null, period: { from: from ?? null, to: to ?? null } });
}

export async function getThroughput(req: Request, res: Response): Promise<void> {
  const { granularity = 'hour', from, to } = req.query as Record<string, string>;
  const trunc = granularity === 'minute' ? 'minute' : 'hour';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (from) { params.push(from); conditions.push(`started_at >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`started_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
      date_trunc('${trunc}', started_at) AS timestamp,
      COUNT(*) AS request_count
    FROM inference_logs
    ${where}
    GROUP BY 1
    ORDER BY 1 ASC`,
    params
  );

  res.json({ granularity, buckets: rows });
}

export async function getErrors(req: Request, res: Response): Promise<void> {
  const { provider, from, to } = req.query as Record<string, string>;

  const conditions: string[] = ["status = 'error'"];
  const params: unknown[] = [];

  if (provider) { params.push(provider); conditions.push(`provider = $${params.length}`); }
  if (from)     { params.push(from);     conditions.push(`started_at >= $${params.length}`); }
  if (to)       { params.push(to);       conditions.push(`started_at <= $${params.length}`); }

  const where = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
      provider,
      model,
      error_code,
      COUNT(*) AS count,
      ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY provider, model), 0), 2) AS error_rate_pct
    FROM inference_logs
    WHERE ${where}
    GROUP BY provider, model, error_code
    ORDER BY count DESC`,
    params
  );

  res.json({ data: rows });
}
