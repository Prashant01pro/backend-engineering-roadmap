import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getIncidentConversation, getDirectConversation, getMessages } from './chat.controller.js';

const router = express.Router();

router.use(authenticate);

// Get or initialize incident chat
router.get('/incidents/:incidentId/conversation', getIncidentConversation);

// Get or initialize 1-to-1 direct chat
router.get('/direct/:recipientId', getDirectConversation);

// Cursor-paginated message history
router.get('/conversations/:conversationId/messages', getMessages);

export default router;