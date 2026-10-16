import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Document must belong to a user'],
            index: true
        },
        originalName: {
            type: String,
            required: [true, 'Original filename is required'],
            trim: true,
            maxLength: 255
        },
        storageKey: {
            type: String,
            required: true,
            unique: true
        },
        mimeType: {
            type: String,
            required: true,
            enum: ['application/pdf']
        },
        size: {
            type: Number,
            required: true,
            max: 10 * 1024 * 1024 // 10MB
        }
    },
    {
        timestamps: true
    }
)

// Compound index: Fast lookup by owner and creation date
documentSchema.index({ owner: 1, createdAt: -1 })

const Document = mongoose.model('Document', documentSchema)
export default Document