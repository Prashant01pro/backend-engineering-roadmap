import Incident from '../incidents/incident.model.js';
import mongoose from 'mongoose';

// Helper: Encode cursor { createdAt, _id } to base64
const encodeCursor = (doc) => {
    if (!doc) return null;
    return Buffer.from(JSON.stringify({ createdAt: doc.createdAt, id: doc._id })).toString('base64');
};

// Helper: Decode base64 cursor
const decodeCursor = (cursorString) => {
    try {
        return JSON.parse(Buffer.from(cursorString, 'base64').toString('utf8'));
    } catch {
        return null;
    }
};

// construct common query filter
const buildSearchFilter = ({ q, status, severity, teamId, from, to }) => {
    const filter = {};

    if (q) {
        // Regex search on title (or text search)
        filter.title = { $regex: q.trim(), $options: 'i' };
    }

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (teamId) filter.assignedTeam = new mongoose.Types.ObjectId(teamId);

    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }
    return filter;
}

// cursor / keyset pagination search(O(1) constant time)
export const searchIncidentsCursorService = async (params) => {
    const { cursor, limit = 20, ...filters } = params
    const pageLimit = Math.min(Number(limit), 100)

    const query = buildSearchFilter(filters);

    if (cursor) {
        const decoded = decodeCursor(cursor)
        if (decoded) {
            query.$or = [
                { createdAt: { $lt: new Date(decoded.createdAt) } },
                {
                    createdAt: new Date(decoded.createdAt),
                    _id: { $lt: new mongoose.Types.ObjectId(decoded.id) }
                }
            ];
        }
    }

    // Fetch limit + 1 to check if a next page exists
    const incidents = await Incident.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .populate('assignedTeam', 'name slug')
        .populate('assignedTo', 'name email');

    const hasNextPage = incidents.length > pageLimit;
    const results = hasNextPage ? incidents.slice(0, pageLimit) : incidents;
    const nextCursor = hasNextPage ? encodeCursor(results[results.length - 1]) : null;

    return {
        paginationType: 'cursor',
        count: results.length,
        hasNextPage,
        nextCursor,
        data: results
    };
}

// Traditional Offset Pagination Search (for benchmarking)
export const searchIncidentsOffsetService = async (params) => {
    const { page = 1, limit = 20, ...filters } = params;

    const pageLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * pageLimit;
    const query = buildSearchFilter(filters);

    const [data, total] = await Promise.all([
        Incident.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(pageLimit)
            .populate('assignedTeam', 'name slug')
            .populate('assignedTo', 'name email'),
        Incident.countDocuments(query)
    ]);

    return {
        paginationType: 'offset',
        pagination: {
            total,
            page: Number(page),
            limit: pageLimit,
            totalPages: Math.ceil(total / pageLimit)
        },
        data
    };
};


// Execution Plan Profiler (.explain('executionStats'))
export const explainSearchQueryService = async (params) => {
    const query = buildSearchFilter(params);

    // Run explain with executionStats
    const explanation = await Incident.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .explain('executionStats');

    const stats = explanation.executionStats;

    return {
        winningPlanStage: explanation.queryPlanner?.winningPlan?.stage,
        isIndexScan: explanation.queryPlanner?.winningPlan?.stage === 'IXSCAN',
        isCollectionScan: explanation.queryPlanner?.winningPlan?.stage === 'COLLSCAN',
        executionSuccess: stats.executionSuccess,
        totalDocsExamined: stats.totalDocsExamined, // Should be close to nReturned if indexed!
        nReturned: stats.nReturned,
        executionTimeMillis: stats.executionTimeMillis,
        fullPlan: explanation
    };
};