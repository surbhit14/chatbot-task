import { Request, Response } from 'express';
import { pool } from '../db';
import { sseStart, sseWrite, sseEnd } from '../sse';
import { wrap } from '@ollive/sdk';
import { config } from '../config';
import OpenAI from 'openai';

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id: conversationId } = req.params;
  const { content, model = config.openaiModel } = req.body ?? {};
  // OpenRouter model strings are "provider/model-name" (e.g. "openai/gpt-4o")
  const provider = model.includes('/') ? model.split('/')[0] : 'openrouter';

  if (!content || typeof content !== 'string' || content.trim() === '') {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  // check conversation exists and is active
  const { rows: convRows } = await pool.query(
    `SELECT * FROM conversations WHERE id = $1`,
    [conversationId]
  );

  if (convRows.length === 0) {
    res.status(404).json({ error: 'conversation not found' });
    return;
  }

  if (convRows[0].status !== 'active') {
    res.status(409).json({ error: `conversation is ${convRows[0].status}` });
    return;
  }

  // get next sequence_num
  const { rows: seqRows } = await pool.query(
    `SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next FROM messages WHERE conversation_id = $1`,
    [conversationId]
  );
  const userSeq: number = seqRows[0].next;

  // insert user message
  const { rows: userMsgRows } = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, sequence_num)
     VALUES ($1, 'user', $2, $3) RETURNING *`,
    [conversationId, content.trim(), userSeq]
  );
  const userMessage = userMsgRows[0];

  // load context window
  const { rows: history } = await pool.query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY sequence_num ASC
     LIMIT $2`,
    [conversationId, config.contextWindowMessages]
  );

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // reserve assistant message id
  const assistantSeq = userSeq + 1;
  const { rows: asstMsgRows } = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, sequence_num, provider, model)
     VALUES ($1, 'assistant', '', $2, $3, $4) RETURNING id`,
    [conversationId, assistantSeq, provider, model]
  );
  const assistantMessageId: string = asstMsgRows[0].id;

  // start SSE
  sseStart(res);
  sseWrite(res, 'message_start', { message_id: assistantMessageId, conversation_id: conversationId, role: 'assistant' });

  const abortController = new AbortController();
  let fullOutput = '';

  req.on('close', () => {
    abortController.abort();
  });

  try {
    await wrap(
      { messages, signal: abortController.signal },
      {
        provider,
        model,
        conversation_id: conversationId,
        message_id: assistantMessageId,
        input: content.trim(),
      },
      (delta) => {
        fullOutput += delta;
        sseWrite(res, 'content_delta', { delta });
      }
    );

    // update assistant message with final content
    await pool.query(
      `UPDATE messages SET content = $1 WHERE id = $2`,
      [fullOutput, assistantMessageId]
    );

    sseWrite(res, 'message_end', { message_id: assistantMessageId });
    sseEnd(res);
  } catch (err: unknown) {
    const isCancelled = err instanceof Error && err.name === 'AbortError';

    if (isCancelled) {
      // persist partial content and mark conversation cancelled
      await pool.query(`UPDATE messages SET content = $1 WHERE id = $2`, [fullOutput, assistantMessageId]);
      await pool.query(`UPDATE conversations SET status = 'cancelled' WHERE id = $1`, [conversationId]);
    } else {
      // remove the placeholder assistant message on hard error
      await pool.query(`DELETE FROM messages WHERE id = $1`, [assistantMessageId]);
      // also remove user message to keep sequence consistent
      await pool.query(`DELETE FROM messages WHERE id = $1`, [userMessage.id]);
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'inference failed' });
    } else {
      sseWrite(res, 'error', { message: isCancelled ? 'cancelled' : 'inference failed' });
      res.end();
    }
  }
}
