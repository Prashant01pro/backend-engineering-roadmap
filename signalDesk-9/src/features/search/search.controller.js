import { catchAsync } from '../../utils/catchAsync.js';
import { searchIncidentsCursorService, searchIncidentsOffsetService, explainSearchQueryService } from './search.service.js';

export const searchIncidentsCursor = catchAsync(async (req, res) => {
    const start = performance.now();
    const result = await searchIncidentsCursorService(req.query);
    const durationMs = (performance.now() - start).toFixed(2);

    res.set('X-Response-Time-Ms', durationMs);

    res.status(200).json({
        status: 'success',
        executionTimeMs: durationMs,
        ...result
    });
});

export const searchIncidentsOffset = catchAsync(async (req, res) => {
    const start = performance.now();
    const result = await searchIncidentsOffsetService(req.query);
    const durationMs = (performance.now() - start).toFixed(2);

    res.set('X-Response-Time-Ms', durationMs);

    res.status(200).json({
        status: 'success',
        executionTimeMs: durationMs,
        ...result
    });
});

export const explainSearch = catchAsync(async (req, res) => {
    const metrics = await explainSearchQueryService(req.query);

    res.status(200).json({
        status: 'success',
        data: metrics
    });
});