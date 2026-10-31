import { catchAsync } from '../../utils/catchAsync.js';
import { getIncidentAnalyticsService } from './analytics.service.js';

export const getIncidentAnalytics = catchAsync(async (req, res) => {
    const { teamId } = req.query;
    const { source, stats } = await getIncidentAnalyticsService(teamId);

    // Set custom header so you can verify cache hits in Postman / browser
    res.set('X-Cache-Source', source);

    res.status(200).json({
        status: 'success',
        source, // 'cache' or 'database'
        data: stats
    });
});