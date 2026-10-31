import Incident, { INCIDENT_STATUS } from '../incidents/incident.model.js';
import { redis } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import mongoose from 'mongoose';

const CACHE_TTL_SECONDS = 15 * 60;

// Helper: Generate structured cache keys
const getStatsCacheKey = (teamId = 'global') => `analytics:stats:team:${teamId}`;

// Compute Incident Dashboard Analytics with Redis Cache-Aside

export const getIncidentAnalyticsService = async (teamId = null) => {
    const cacheKey = getStatsCacheKey(teamId || 'global');

    // check redis cache
    try {
        const cachedData = await redis.get(cacheKey)

        if (cachedData) {
            logger.debug({ cacheKey }, 'Redis Cache HIT: Returning cached analytics');
            return {
                source: 'cache',
                stats: JSON.parse(cachedData)
            }
        }

    } catch (err) {
        logger.warn({ err }, 'Redis read error. Falling back to MongoDB.');
    }

    logger.debug({ cacheKey }, 'Redis Cache MISS: Executing MongoDB aggregation pipeline');

    // single-pass mongodb aggregation pipeline
    const matchStage = {};
    if (teamId) {
        matchStage.assignedTeam = new mongoose.Types.ObjectId(teamId);
    }

    const [result] = await Incident.aggregate([
        { $match: matchStage },
        {
            $facet: {
                // overview counts
                overview: [{
                    $group: {
                        _id: null, total: { $sum: 1 },
                        open: {
                            $sum: {
                                $cond: [{ $in: ['$status', [INCIDENT_STATUS.REPORTED, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.INVESTIGATING]] }, 1, 0]
                            }
                        },
                        critical: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
                        resolved: { $sum: { $cond: [{ $in: ['$status', [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CLOSED]] }, 1, 0] } }

                    }
                }],
                // breakdown by serverity
                bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
                // breakdown by status
                byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],

                // Mean Time to Resolution (MTTR) calculation for resolved incidents
                resolutionMetrics: [
                    {
                        $match: {
                            resolvedAt: { $ne: null },
                            status: { $in: [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CLOSED] }
                        }
                    },
                    {
                        $project: {
                            // Calculate duration in milliseconds: resolvedAt - createdAt
                            durationMs: { $subtract: ['$resolvedAt', '$createdAt'] }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            avgResolutionMs: { $avg: '$durationMs' },
                            minResolutionMs: { $min: '$durationMs' },
                            maxResolutionMs: { $max: '$durationMs' },
                            resolvedCount: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ])

    // format output
    const overview = result.overview[0] || { total: 0, open: 0, critical: 0, resolved: 0 };
    const resMetrics = result.resolutionMetrics[0] || { avgResolutionMs: 0, minResolutionMs: 0, maxResolutionMs: 0, resolvedCount: 0 };

    const formattedStats = {
        totalIncidents: overview.total,
        openIncidents: overview.open,
        criticalIncidents: overview.critical,
        resolvedIncidents: overview.resolved,
        mttrMinutes: Math.round((resMetrics.avgResolutionMs || 0) / (1000 * 60)), // Convert ms to minutes
        resolutionMetrics: {
            resolvedCount: resMetrics.resolvedCount,
            minMinutes: Math.round((resMetrics.minResolutionMs || 0) / (1000 * 60)),
            maxMinutes: Math.round((resMetrics.maxResolutionMs || 0) / (1000 * 60))
        },
        breakdown: {
            severity: Object.fromEntries(result.bySeverity.map((s) => [s._id, s.count])),
            status: Object.fromEntries(result.byStatus.map((s) => [s._id, s.count]))
        },
        calculatedAt: new Date().toISOString()
    };

    // Store in Redis Cache with TTL
    try {
        await redis.set(cacheKey, JSON.stringify(formattedStats), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
        logger.warn({ err }, 'Failed to cache analytics in Redis');
    }

    return {
        source: 'database',
        stats: formattedStats
    };
}

// Deterministic Cache Invalidation Helper
export const invalidateAnalyticsCache = async (teamId = null) => {
    try {
        const pipeline = redis.pipeline();

        // Always invalidate the global dashboard
        pipeline.del(getStatsCacheKey('global'));

        // If a specific team was affected, invalidate that team's dashboard too
        if (teamId) {
            pipeline.del(getStatsCacheKey(teamId.toString()));
        }

        await pipeline.exec();
        logger.debug({ teamId }, 'Purged analytics Redis cache keys');

    } catch (err) {
        logger.error({ err }, 'Failed to invalidate analytics cache');
    }
};