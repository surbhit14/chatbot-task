import { WrapOptions, InferenceLogPayload } from './types';
import { redact } from './redactor';
import { emitLog } from './emitter';
import { streamOpenAI, OpenAICallOptions } from './providers/openai';
import OpenAI from 'openai';

const INPUT_PREVIEW_LEN = parseInt(process.env.SDK_INPUT_PREVIEW_LENGTH || '200');
const OUTPUT_PREVIEW_LEN = parseInt(process.env.SDK_OUTPUT_PREVIEW_LENGTH || '200');

export type { OpenAICallOptions };

export async function wrap(
  callOptions: { messages: OpenAI.Chat.ChatCompletionMessageParam[]; signal?: AbortSignal },
  wrapOptions: WrapOptions,
  onChunk: (delta: string) => void
): Promise<void> {
  const startedAt = new Date().toISOString();
  let status: InferenceLogPayload['status'] = 'success';
  let error_code: string | null = null;
  let error_message: string | null = null;

  try {
    const result = await streamOpenAI(
      {
        model: wrapOptions.model,
        messages: callOptions.messages,
        signal: callOptions.signal,
      },
      onChunk
    );

    const inputPreview = redact(wrapOptions.input.slice(0, INPUT_PREVIEW_LEN));
    const outputPreview = redact(result.text.slice(0, OUTPUT_PREVIEW_LEN));

    const payload: InferenceLogPayload = {
      provider: wrapOptions.provider,
      model: wrapOptions.model,
      conversation_id: wrapOptions.conversation_id ?? null,
      message_id: wrapOptions.message_id ?? null,
      latency_ms: result.latency_ms,
      ttfb_ms: result.ttfb_ms,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
      total_tokens: result.total_tokens,
      status: 'success',
      error_code: null,
      error_message: null,
      input_preview: inputPreview,
      output_preview: outputPreview,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
    };

    // fire-and-forget
    emitLog(payload);
  } catch (err: unknown) {
    status = 'error';

    if (err instanceof Error && err.name === 'AbortError') {
      status = 'cancelled';
    } else if (err instanceof Error) {
      error_message = err.message;
      const anyErr = err as { status?: number; code?: string };
      error_code = anyErr.code ?? String(anyErr.status ?? 'unknown');
    }

    const payload: InferenceLogPayload = {
      provider: wrapOptions.provider,
      model: wrapOptions.model,
      conversation_id: wrapOptions.conversation_id ?? null,
      message_id: wrapOptions.message_id ?? null,
      latency_ms: null,
      ttfb_ms: null,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      status,
      error_code,
      error_message,
      input_preview: redact(wrapOptions.input.slice(0, INPUT_PREVIEW_LEN)),
      output_preview: null,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
    };

    emitLog(payload);
    throw err;
  }
}
