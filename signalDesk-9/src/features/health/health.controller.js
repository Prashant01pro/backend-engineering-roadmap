import mongoose from 'mongoose';
import os from 'os';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';

const MONGO_STATE_MAP = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
};

const formatBytes = (bytes) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// Liveness probe: verifies process is alive and responsive
export const getLiveness = (req, res) => {
    const memory = process.memoryUsage();

    res.status(200).json({
        status: 'UP',
        probe: 'liveness',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version,
        memory: {
            rss: formatBytes(memory.rss),
            heapTotal: formatBytes(memory.heapTotal),
            heapUsed: formatBytes(memory.heapUsed)
        }
    });
};

// Dedicated MongoDB Health Check
export const getDatabaseHealth = async (req, res) => {
    const state = mongoose.connection.readyState;
    const isConnected = state === 1;

    let latencyMs = null;
    let error = null;

    if (isConnected && mongoose.connection.db) {
        try {
            const start = performance.now();
            await mongoose.connection.db.admin().ping();
            latencyMs = +(performance.now() - start).toFixed(2);
        } catch (err) {
            error = err.message;
        }
    }

    const healthy = isConnected && !error;

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'UP' : 'DOWN',
        service: 'mongodb',
        state: MONGO_STATE_MAP[state] || 'unknown',
        database: mongoose.connection.name || null,
        host: mongoose.connection.host || null,
        latencyMs,
        error: error || null
    });
};

// Dedicated Redis Health Check
export const getRedisHealth = async (req, res) => {
    let latencyMs = null;
    let pong = null;
    let error = null;

    try {
        const start = performance.now();
        pong = await redis.ping();
        latencyMs = +(performance.now() - start).toFixed(2);
    } catch (err) {
        error = err.message;
    }

    const healthy = pong === 'PONG' && !error;

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'UP' : 'DOWN',
        service: 'redis',
        response: pong,
        latencyMs,
        error: error || null
    });
};

// System & Resource Health Check
export const getSystemHealth = (req, res) => {
    const memory = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        process: {
            pid: process.pid,
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            memory: {
                rss: formatBytes(memory.rss),
                heapTotal: formatBytes(memory.heapTotal),
                heapUsed: formatBytes(memory.heapUsed),
                external: formatBytes(memory.external)
            }
        },
        host: {
            platform: os.platform(),
            architecture: os.arch(),
            cpuCount: os.cpus().length,
            loadAvg: os.loadavg(),
            totalMemory: formatBytes(totalMem),
            freeMemory: formatBytes(freeMem),
            memoryUsagePercent: `${(((totalMem - freeMem) / totalMem) * 100).toFixed(1)}%`
        }
    });
};

// Combined Full Readiness Probe (Load Balancer & Kubernetes)
export const getReadiness = async (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const isMongoConnected = mongoState === 1;

    let mongoLatency = null;
    let mongoError = null;

    if (isMongoConnected && mongoose.connection.db) {
        try {
            const start = performance.now();
            await mongoose.connection.db.admin().ping();
            mongoLatency = +(performance.now() - start).toFixed(2);
        } catch (err) {
            mongoError = err.message;
        }
    }

    const isMongoOk = isMongoConnected && !mongoError;

    let redisLatency = null;
    let redisPong = null;
    let redisError = null;

    try {
        const start = performance.now();
        redisPong = await redis.ping();
        redisLatency = +(performance.now() - start).toFixed(2);
    } catch (err) {
        redisError = err.message;
    }

    const isRedisOk = redisPong === 'PONG' && !redisError;
    const isAllReady = isMongoOk && isRedisOk;

    const memory = process.memoryUsage();

    res.status(isAllReady ? 200 : 503).json({
        status: isAllReady ? 'READY' : 'DEGRADED',
        service: 'SignalDesk',
        environment: env.NODE_ENV || process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        checks: {
            database: {
                status: isMongoOk ? 'UP' : 'DOWN',
                state: MONGO_STATE_MAP[mongoState] || 'unknown',
                latencyMs: mongoLatency,
                error: mongoError || null
            },
            redis: {
                status: isRedisOk ? 'UP' : 'DOWN',
                latencyMs: redisLatency,
                error: redisError || null
            },
            collaboration: {
                status: 'UP',
                port: env.HOCUSPOCUS_PORT || 5464,
                protocol: 'yjs/ws'
            }
        },
        memory: {
            rss: formatBytes(memory.rss),
            heapUsed: formatBytes(memory.heapUsed)
        }
    });
};

