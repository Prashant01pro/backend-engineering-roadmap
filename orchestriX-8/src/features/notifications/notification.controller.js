import { getUserNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotificationById } from './notification.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const getNotifications = catchAsync(async (req, res) => {
    const { page, limit, unreadOnly } = req.query;
    const result = await getUserNotifications(req.user._id, {
        page,
        limit,
        unreadOnly: unreadOnly === 'true',
    });

    res.status(200).json({
        status: 'success',
        ...result,
    });
});

export const getUnreadCount = catchAsync(async (req, res) => {
    const unreadCount = await getUnreadNotificationCount(req.user._id);
    res.status(200).json({
        status: 'success',
        unreadCount,
    });
});

export const markRead = catchAsync(async (req, res) => {
    const { id } = req.params;
    const notification = await markNotificationAsRead(id, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Notification marked as read',
        data: notification,
    });
});

export const markAllRead = catchAsync(async (req, res) => {
    const result = await markAllNotificationsAsRead(req.user._id);
    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
        ...result,
    });
});

export const removeNotification = catchAsync(async (req, res) => {
    const { id } = req.params;
    await deleteNotificationById(id, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Notification deleted successfully',
    });
});