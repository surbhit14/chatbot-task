import express from 'express';
import cors from 'cors';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/conversations', conversationsRouter);
app.use('/api/conversations/:id/messages', messagesRouter);

app.use(errorHandler);

export default app;
