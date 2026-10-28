import mongoose from "mongoose";
import { required } from "zod/mini";

export const NOTIFICATION_TYPES = {
    JOB_COMPLETED: 'JOB_COMPLETED',
    JOB_FAILED: 'JOB_FAILED',
    SECURITY_ALERT: 'SECURITY_ALERT',
    WELCOME: 'WELCOME',
    SYSTEM: 'SYSTEM',
};

export const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Notification must belong to a user'],
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(NOTIFICATION_TYPES),
            default: NOTIFICATION_TYPES.SYSTEM,
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Notification title is required'],
            trim: true,
            maxLength: 120,
        },
        message: {
            type: String,
            required: [true, 'Notification message is required'],
            trim: true,
            maxLength: 500,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        readAt: {
            type: Date,
            default: null, // null means unread!
            index: true,
        },

    },
    {
        timestamps: true
    }
)

// High-performance compound index for fetching a user's unread notifications quickly
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification;