import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getNotifications, getUnreadCount, markRead, markAllRead, removeNotification, streamNotification } from './notification.controller.js';

const router = express.Router();

router.use(authenticate); // User Must be logged in

// Real-time SSE stream endpoint (mount before parameterized routes)
router.get('/stream', streamNotification);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', removeNotification);

export default router;