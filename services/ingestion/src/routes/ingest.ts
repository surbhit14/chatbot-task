import { Router } from 'express';
import { ingestLog, listLogs } from '../controllers/ingest';

const router = Router();

router.get('/logs', listLogs);
router.post('/logs', ingestLog);

export default router;
