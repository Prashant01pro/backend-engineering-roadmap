import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = {
    INCIDENT_ASSIGNED: 'INCIDENT_ASSIGNED',
    INCIDENT_STATUS_CHANGED: 'INCIDENT_STATUS_CHANGED',
    TEAM_INVITE: 'TEAM_INVITE',
    COMMENT_ADDED: 'COMMENT_ADDED'
};

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        type: {
            type: String,
            enum: Object.values(NOTIFICATION_TYPES),
            required: true
        },
        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        resourceType: {
            type: String,
            enum: ['Incident', 'Team', 'Comment'],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// High-performance compound index for unread badge counters and paginated lists
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;