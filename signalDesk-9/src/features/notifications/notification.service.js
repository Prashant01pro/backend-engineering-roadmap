import Notification from './notification.model.js';
import { getIO } from '../../sockets/socket.server.js';
import { logger } from '../../config/logger.js';
import AppError from '../../utils/appError.js';

export const sendNotificationService = async ({ recipient, actor, type, resourceId, resourceType, title, message }) => {
    // prevent self-notifications
    if (recipient.toString() === actor.toString()) {
        return null;
    }

    const notification = await Notification.create({
        recipient,
        actor,
        type,
        resourceId,
        resourceType,
        title,
        message
    })

    await notification.populate('actor', 'name email avatar');

    // Push real-time event to the recipient's private room
    try {
        const io = getIO();
        io.to(`user:${recipient.toString()}`).emit('notification:new', notification);
        logger.debug({ recipient, type }, 'Real-time notification emitted via Socket.IO');
    } catch (error) {
        // Socket push failure does NOT fail the durable database save
    }
    return notification;
}

// Fetch paginated notifications for the logged-in user
export const getUserNotificationsService = async (userId, { page = 1, limit = 20, unreadOnly = false }) => {
    const filter = { recipient: userId };

    if (unreadOnly === 'true' || unreadOnly === true) {
        filter.isRead = false;
    }
    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('actor', 'name email avatar'),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: userId, isRead: false })
    ]);

    return {
        notifications,
        unreadCount,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        }
    };
}

// Mark single notification as read
export const markNotificationAsReadService = async (notificationId, userId) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { $set: { isRead: true, readAt: new Date() } },
        { returnDocument: 'after' }
    )

    if (!notification) {
        throw new AppError('Notification not found', 404);
    }
    return notification;

}

// Mark all notifications as read
export const markAllNotificationsAsReadService = async (userId) => {
    await Notification.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );

    return { success: true };
};

// Get unread notification badge counter
export const getUnreadCountService = async (userId) => {
    const count = await Notification.countDocuments({ recipient: userId, isRead: false });
    return { unreadCount: count };
};