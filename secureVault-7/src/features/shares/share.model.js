import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
    {
        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Document',
            required: [true, 'Share link must refer to a document'],
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Share must have an owner'],
            index: true
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: [true, 'Expiration date is required'],
            index: true
        },
        maxAccessCount: {
            type: Number,
            default: null // null means unlimited accesses until expiresAt
        },
        accessCount: {
            type: Number,
            default: 0
        },
        isRevoked: {
            type: Boolean,
            default: false,
            index: true
        },
        // Audit trail: track who downloaded via this link
        accessLogs: [
            {
                accessedAt: { type: Date, default: Date.now },
                ip: String,
                userAgent: String
            }
        ]
    },
    {
        timestamps: true
    }
)

const Share = mongoose.model('Share', shareSchema)
export default Share

