import { Router } from 'express';
import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
} from '../controllers/conversations';

const router = Router();

router.post('/', createConversation);
router.get('/', listConversations);
router.get('/:id', getConversation);
router.patch('/:id', updateConversation);
router.delete('/:id', deleteConversation);

export default router;
