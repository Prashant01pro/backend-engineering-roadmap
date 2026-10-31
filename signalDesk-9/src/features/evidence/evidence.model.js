import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
    {
        incident: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Incident',
            required: [true, 'Evidence must be associated with an incident'],
            index: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        originalName: {
            type: String,
            required: true,
            trim: true
        },
        mimeType: {
            type: String,
            required: true,
            default: 'image/webp'
        },
        sizeBytes: {
            type: Number,
            required: true
        },
        // Storage URLs / Keys
        displayUrl: {
            type: String,
            required: true
        },
        thumbnailUrl: {
            type: String,
            required: true
        },
        displayPublicId: {
            type: String,
            required: true
        },
        thumbnailPublicId: {
            type: String,
            required: true
        },
        // Image Dimensions
        width: {
            type: Number,
            required: true
        },
        height: {
            type: Number,
            required: true
        },
        caption: {
            type: String,
            trim: true,
            maxLength: [200, 'Caption cannot exceed 200 characters'],
            default: ''
        }
    },
    {
        timestamps: true
    }
);

evidenceSchema.index({ incident: 1, createdAt: -1 });

const Evidence = mongoose.model('Evidence', evidenceSchema);
export default Evidence;