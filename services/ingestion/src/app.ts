import express from 'express';
import cors from 'cors';
import ingestRouter from './routes/ingest';
import metricsRouter from './routes/metrics';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/ingest', ingestRouter);
app.use('/api/metrics', metricsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: 'internal server error' });
});

export default app;
