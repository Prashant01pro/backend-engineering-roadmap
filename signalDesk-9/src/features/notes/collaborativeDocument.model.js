import mongoose from 'mongoose';

const collaborativeDocumentSchema = new mongoose.Schema(
    {
        documentName: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Note',
            required: true,
            index: true
        },
        incidentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Incident',
            required: true,
            index: true
        },
        // Store raw binary Yjs update buffer (CRDT state vector)
        state: {
            type: Buffer,
            required: true
        },
        snapshotVersion: {
            type: Number,
            default: 1
        },
        lastPersistedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

const CollaborativeDocument = mongoose.model('CollaborativeDocument', collaborativeDocumentSchema);
export default CollaborativeDocument;