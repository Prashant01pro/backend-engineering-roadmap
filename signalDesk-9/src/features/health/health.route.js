import express from 'express';
import { getLiveness, getReadiness, getDatabaseHealth, getRedisHealth, getSystemHealth } from './health.controller.js';

const router = express.Router();

// Root health check returns full readiness inspection
router.get('/', getReadiness);

// Liveness probe (Kubernetes / Orchestrator heartbeat)
router.get('/live', getLiveness);

// Readiness probe (Load Balancer traffic gatekeeper)
router.get('/ready', getReadiness);

// Subsystem health checks
router.get('/database', getDatabaseHealth);
router.get('/redis', getRedisHealth);
router.get('/system', getSystemHealth);

export default router;

