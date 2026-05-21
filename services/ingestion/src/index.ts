import app from './app';
import { config } from './config';
import { pool } from './db';

const server = app.listen(config.port, () => {
  console.log(`ingestion service listening on port ${config.port}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
  process.exit(0);
});
