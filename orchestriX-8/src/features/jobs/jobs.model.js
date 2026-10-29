import mongoose from 'mongoose';

export const JOB_TYPES = {
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    PASSWORD_RESET: "PASSWORD_RESET",
    WELCOME_EMAIL: "WELCOME_EMAIL",
    REPORT_GENERATION: "REPORT_GENERATION",
    DATA_EXPORT: "DATA_EXPORT"
}

export const JOB_STATUS = {
    CREATED: 'CREATED',
    QUEUED: 'QUEUED',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
}

const jobSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // null for system-generated jobs
            index: true
        },
        type: {
            type: String,
            required: [true, 'Job type is required'],
            enum: Object.values(JOB_TYPES),
            index: true
        },
        status: {
            type: String,
            enum: Object.values(JOB_STATUS),
            default: JOB_STATUS.CREATED,
            index: true,
        },
        bullJobId: {
            type: String,
            default: null,
            index: true, // Used to correlate BullMQ events back to this mongodb document
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,  //which allows you to store different types of data without defining a fixed structure for them.
            default: {}
        },
        result: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        // Live progress tracking
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3
        },
        errorSummary: {
            type: String,
            default: null
        },
        startedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        failedAt: {
            type: Date,
            default: null,
        },
        currentStage: {
            type: String,
            default: 'Enqueued',
        },
        executionTimeMs: {
            type: Number,
            default: 0,
        },
        //// ... remaining fields (payload, result, idempotencyKey, etc.) ...
    },
    {
        timestamps: true
    }
)

// Compound index for querying user jobs by status and creation date
jobSchema.index({ ownerId: 1, status: 1, createdAt: 1 })

//indexes help you retrieve data efficiently without scanning every document in a collection.
// What does 1 mean?
// 1 means ascending order.
// -1 means descending order.
//It specifies the index's sort direction.

// jobSchema.index({ createdAt: 1 });
// This indexes createdAt in ascending order, from older dates to newer dates. 

const Job = mongoose.model('Job', jobSchema)
export default Job

//Mixed provides flexibility rather than a fixed data structure.
//Mongoose won't automatically validate the internal structure of the value against a schema you haven't defined.