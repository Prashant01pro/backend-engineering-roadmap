import mongoose from 'mongoose';

const noteHistorySchema = new mongoose.Schema(
    {
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
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        operation: {
            type: String,
            enum: ['INITIAL_CREATED', 'PERIODIC_SNAPSHOT', 'INCIDENT_RESOLVED', 'MANUAL_RESTORE'],
            default: 'PERIODIC_SNAPSHOT'
        },
        snapshotVersion: {
            type: Number,
            required: true
        },
        stateSnapshot: {
            type: Buffer,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const NoteHistory = mongoose.model('NoteHistory', noteHistorySchema);
export default NoteHistory;