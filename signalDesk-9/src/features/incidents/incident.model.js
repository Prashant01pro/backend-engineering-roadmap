import mongoose from 'mongoose';

export const INCIDENT_STATUS = {
    REPORTED: 'REPORTED',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    INVESTIGATING: 'INVESTIGATING',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED'
};

export const INCIDENT_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

// Subdocument for audit history tracking
const timelineEntrySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: ['CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENT_ADDED']
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

// Subdocument for incident comments
const commentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: [true, 'Comment content cannot be empty'],
            trim: true,
            maxLength: [1000, 'Comment cannot exceed 1000 characters']
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: true }
);

const incidentSchema = new mongoose.Schema(
    {
        incidentNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },
        title: {
            type: String,
            required: [true, 'Incident title is required'],
            trim: true,
            minLength: [5, 'Title must be at least 5 characters'],
            maxLength: [150, 'Title cannot exceed 150 characters']
        },
        description: {
            type: String,
            required: [true, 'Incident description is required'],
            trim: true,
            maxLength: [5000, 'Description cannot exceed 5000 characters']
        },
        severity: {
            type: String,
            enum: Object.values(INCIDENT_SEVERITY),
            default: INCIDENT_SEVERITY.MEDIUM,
            index: true
        },
        status: {
            type: String,
            enum: Object.values(INCIDENT_STATUS),
            default: INCIDENT_STATUS.REPORTED,
            index: true
        },
        assignedTeam: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: [true, 'Incident must be assigned to a team'],
            index: true
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        timeline: [timelineEntrySchema],
        comments: [commentSchema],
        resolvedAt: { type: Date, default: null },
        closedAt: { type: Date, default: null }
    },
    {
        timestamps: true
    }
);

// Compound indexes for high-frequency queries
incidentSchema.index({ assignedTeam: 1, status: 1, createdAt: -1 });
incidentSchema.index({ assignedTo: 1, status: 1 });

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;