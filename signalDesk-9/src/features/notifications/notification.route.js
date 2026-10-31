import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } from './notification.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.patch('/mark-all-read', markAllAsRead);

export default router;