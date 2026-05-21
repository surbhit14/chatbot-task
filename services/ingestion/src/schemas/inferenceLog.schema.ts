import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schema = {
  type: 'object',
  required: ['provider', 'model', 'status', 'started_at'],
  additionalProperties: false,
  properties: {
    provider: { type: 'string', minLength: 1 },
    model: { type: 'string', minLength: 1 },
    conversation_id: { type: ['string', 'null'] },
    message_id: { type: ['string', 'null'] },
    latency_ms: { type: ['integer', 'null'], minimum: 0 },
    ttfb_ms: { type: ['integer', 'null'], minimum: 0 },
    prompt_tokens: { type: ['integer', 'null'], minimum: 0 },
    completion_tokens: { type: ['integer', 'null'], minimum: 0 },
    total_tokens: { type: ['integer', 'null'], minimum: 0 },
    status: { type: 'string', enum: ['success', 'error', 'cancelled'] },
    error_code: { type: ['string', 'null'] },
    error_message: { type: ['string', 'null'] },
    input_preview: { type: ['string', 'null'] },
    output_preview: { type: ['string', 'null'] },
    started_at: { type: 'string', format: 'date-time' },
    ended_at: { type: ['string', 'null'], format: 'date-time' },
  },
};

export const validateInferenceLog = ajv.compile(schema);
