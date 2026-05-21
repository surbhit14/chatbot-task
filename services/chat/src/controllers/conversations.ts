import { Request, Response } from 'express';
import { pool } from '../db';

export async function createConversation(req: Request, res: Response): Promise<void> {
  const { title, metadata = {} } = req.body ?? {};

  const { rows } = await pool.query(
    `INSERT INTO conversations (title, metadata)
     VALUES ($1, $2)
     RETURNING *`,
    [title ?? null, JSON.stringify(metadata)]
  );

  res.status(201).json(rows[0]);
}

export async function listConversations(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt((req.query.page as string) || '1'));
  const limit = Math.min(100, parseInt((req.query.limit as string) || '20'));
  const status = req.query.status as string | undefined;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT
      c.*,
      COUNT(m.id)::int AS message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countParams: unknown[] = status ? [status] : [];
  const countWhere = status ? `WHERE status = $1` : '';
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM conversations ${countWhere}`,
    countParams
  );

  res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rows: convRows } = await pool.query(
    `SELECT * FROM conversations WHERE id = $1`,
    [id]
  );

  if (convRows.length === 0) {
    res.status(404).json({ error: 'conversation not found' });
    return;
  }

  const { rows: messages } = await pool.query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sequence_num ASC`,
    [id]
  );

  res.json({ ...convRows[0], messages });
}

export async function updateConversation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body ?? {};

  const allowed = ['active', 'cancelled', 'completed'];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE conversations SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'conversation not found' });
    return;
  }

  res.json(rows[0]);
}

export async function deleteConversation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rowCount } = await pool.query(
    `DELETE FROM conversations WHERE id = $1`,
    [id]
  );

  if (rowCount === 0) {
    res.status(404).json({ error: 'conversation not found' });
    return;
  }

  res.status(204).send();
}
