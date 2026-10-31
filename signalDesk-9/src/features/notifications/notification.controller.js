import { catchAsync } from '../../utils/catchAsync.js';
import { getUserNotificationsService, markNotificationAsReadService, markAllNotificationsAsReadService, getUnreadCountService } from './notification.service.js';

export const getMyNotifications = catchAsync(async (req, res) => {
    const result = await getUserNotificationsService(req.user._id, req.query);

    res.status(200).json({
        status: 'success',
        unreadCount: result.unreadCount,
        pagination: result.pagination,
        data: { notifications: result.notifications }
    });
});

export const getUnreadCount = catchAsync(async (req, res) => {
    const result = await getUnreadCountService(req.user._id);

    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const markAsRead = catchAsync(async (req, res) => {
    const notification = await markNotificationAsReadService(req.params.id, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Notification marked as read',
        data: { notification }
    });
});

export const markAllAsRead = catchAsync(async (req, res) => {
    await markAllNotificationsAsReadService(req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read'
    });
});