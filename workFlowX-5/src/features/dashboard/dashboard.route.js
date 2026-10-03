import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getDashboardStats } from './dashboard.controller.js';

const router = express.Router();

// Require authentication
router.use(authenticate);

router.get('/', getDashboardStats);

export default router;