import { Router } from 'express';
import { getLatency, getThroughput, getErrors } from '../controllers/metrics';

const router = Router();

router.get('/latency', getLatency);
router.get('/throughput', getThroughput);
router.get('/errors', getErrors);

export default router;
