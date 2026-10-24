import express from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis.js';

const router = express.Router();

// liveness probe: verifies the node process is running
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'up',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    })
})

//  Database Health 
router.get('/database', (req, res) => {
    const state = mongoose.connection.readyState;
    const isConnected = state === 1;

    const stateMap = {
        0: 'disconnected',
        1: 'disconnected',
        2: 'disconnected',
        3: 'disconnected'
    }

    res.status(isConnected ? 200 : 503).json({
        status: isConnected ? 'UP' : 'DOWN',
        database: 'mongodb',
        state: stateMap[state] || 'unknown'
    })
})

// Redis Health
router.get('/redis', async (req, res) => {
    try {
        const start = Date.now()
        const pong = await redis.ping();
        const latencyMs = Date.now() - start;

        res.status(200).json({
            status: 'UP',
            service: 'redis',
            response: pong,
            latencyMs,
        });
    } catch (error) {
        res.status(503).json({
            status: 'DOWN',
            service: 'redis',
            error: error.message,
        });
    }
})

// Combined Readiness, Used by Load Balancers
router.get('/ready', async (req, res) => {
    const isMongoOk = mongoose.connection.readyState === 1;
    let isRedisOk = false;
    let redisLatency = null;

    try {
        const start = Date.now();
        await redis.ping();
        redisLatency = Date.now() - start;
        isRedisOk = true;
    } catch {
        isRedisOk = false;
    }

    const isReady = isMongoOk && isRedisOk;

    res.status(isReady ? 200 : 503).json({
        status: isReady ? 'READY' : 'NOT_READY',
        timestamp: new Date().toISOString(),
        checks: {
            database: isMongoOk ? 'UP' : 'DOWN',
            redis: isRedisOk ? 'UP' : 'DOWN',
            redisLatencyMs: redisLatency,
        },
    });
});

export default router;