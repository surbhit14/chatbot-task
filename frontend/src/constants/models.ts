export interface ModelOption {
  label: string;
  value: string;
  provider: string;
}

export const MODELS: ModelOption[] = [
  // OpenAI
  { label: 'GPT-4.1', value: 'openai/gpt-4.1', provider: 'openai' },
  { label: 'GPT-4o', value: 'openai/gpt-4o', provider: 'openai' },
  // Anthropic
  { label: 'Claude Sonnet 4.5', value: 'anthropic/claude-sonnet-4-5', provider: 'anthropic' },
  { label: 'Claude Haiku 3.5', value: 'anthropic/claude-3-5-haiku', provider: 'anthropic' },
  // Google
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001', provider: 'google' },
  { label: 'Gemini 2.5 Pro', value: 'google/gemini-2.5-pro-preview', provider: 'google' },
  // DeepSeek
  { label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat', provider: 'deepseek' },
  { label: 'DeepSeek R1', value: 'deepseek/deepseek-r1', provider: 'deepseek' },
  // xAI / Grok
  { label: 'Grok 3', value: 'x-ai/grok-3', provider: 'x-ai' },
  { label: 'Grok 3 Mini', value: 'x-ai/grok-3-mini', provider: 'x-ai' },
];

export const DEFAULT_MODEL = 'openai/gpt-4o';
