import Notification from './notification.model.js';
import { logger } from '../../config/logger.js';
import AppError from '../../utils/appError.js';
import { tryCatch } from 'bullmq';

// Creates and persists a durable notification

export const createNotification = async ({ userId, type, title, message, data = {} }) => {
    try {
        const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            data,
        })

        logger.info({
            notificationId: notification._id,
            userId,
            type,
        }, 'In-app notification created');

        return notification;

    } catch (error) {
        logger.error({ err: error.message, userId }, 'Failed to create in-app notification');
    }
}

// Lists notifications for a user with pagination

export const getUserNotifications = async (userId, { page = 1, limit = 10, unreadOnly = false }) => {
    const filter = { userId };
    if (unreadOnly) {
        filter.readAt = null;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        Notification.countDocuments(filter),
        Notification.countDocuments({ userId, readAt: null }),
    ]);

    return {
        notifications,
        total,
        unreadCount,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
    };
};

// Fast badge counter for unread notifications
export const getUnreadNotificationCount = async (userId) => {
    return await Notification.countDocuments({ userId, readAt: null });
};

// Marks a single notification as read
export const markNotificationAsRead = async (notificationId, userId) => {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) {
        throw new AppError('Notification not found', 404);
    }

    if (!notification.readAt) {
        notification.readAt = new Date();
        await notification.save();
    }
    return notification;
};

//Marks all unread notifications as read for a user
export const markAllNotificationsAsRead = async (userId) => {
    const result = await Notification.updateMany(
        { userId, readAt: null },
        { $set: { readAt: new Date() } }
    )

    return { modifiedCount: result.modifiedCount }
}

//Deletes a notification
export const deleteNotificationById = async (notificationId, userId) => {
    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
    if (!notification) {
        throw new AppError('Notification not found', 404);
    }
    return notification;
};