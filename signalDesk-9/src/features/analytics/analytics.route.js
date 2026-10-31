import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getIncidentAnalytics } from './analytics.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/incidents', getIncidentAnalytics);

export default router;