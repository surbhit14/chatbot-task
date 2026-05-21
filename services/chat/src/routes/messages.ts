import { Router } from 'express';
import { sendMessage } from '../controllers/messages';

const router = Router({ mergeParams: true });

router.post('/', sendMessage);

export default router;
