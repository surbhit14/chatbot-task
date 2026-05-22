import OpenAI from 'openai';
import { ChunkCallback, WrapResult } from '../types';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://ollive.local',
    'X-Title': 'Ollive',
  },
});

export interface OpenAICallOptions {
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  signal?: AbortSignal;
}

export async function streamOpenAI(
  options: OpenAICallOptions,
  onChunk: ChunkCallback
): Promise<WrapResult> {
  const startedAt = Date.now();
  let ttfb_ms: number | null = null;
  let outputText = '';
  let prompt_tokens: number | null = null;
  let completion_tokens: number | null = null;
  let total_tokens: number | null = null;

  const stream = await client.chat.completions.create(
    {
      model: options.model,
      messages: options.messages,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: options.signal }
  );

  for await (const chunk of stream) {
    if (ttfb_ms === null) {
      ttfb_ms = Date.now() - startedAt;
    }

    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      outputText += delta;
      onChunk(delta);
    }

    if (chunk.usage) {
      prompt_tokens = chunk.usage.prompt_tokens;
      completion_tokens = chunk.usage.completion_tokens;
      total_tokens = chunk.usage.total_tokens;
    }
  }

  return {
    text: outputText,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    ttfb_ms,
    latency_ms: Date.now() - startedAt,
  };
}
