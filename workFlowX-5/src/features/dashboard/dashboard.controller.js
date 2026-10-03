import { catchAsync } from '../../utils/catchAsync.js';
import { getDashboardStatsService } from './dashboard.service.js';


export const getDashboardStats = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const stats = await getDashboardStatsService(userId);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});