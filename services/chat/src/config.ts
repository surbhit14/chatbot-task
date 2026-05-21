export const config = {
  port: parseInt(process.env.CHAT_PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  contextWindowMessages: 20,
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'ollive',
    user: process.env.POSTGRES_USER || 'ollive_user',
    password: process.env.POSTGRES_PASSWORD || '',
    max: 10,
  },
};
