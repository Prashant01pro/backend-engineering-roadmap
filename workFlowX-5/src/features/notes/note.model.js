import mongoose from 'mongoose'

const notesSchema = new mongoose.Schema(
    {

        title: {
            type: String,
            required: [true, 'Please provide a note title'],
            trim: true,
            minLength: 2,
            maxLength: 100
        },
        content: {
            type: String,
            required: [true, 'Please provide note content'],
            trim: true,
            maxLength: 5000
        },
        tags: [
            {
                type: String,
                trim: true,
                lowercase: true,
                maxLength: 30
            }
        ],
        isPinned: {
            type: Boolean,
            default: false
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Note must belong to a user'],
            index: true
        }
    },
    {
        timestamps: true
    }
)

// compound index for user and pinned notes sorting 
// This line creates a compound index in Mongoose/MongoDB on the notes collection. It optimizes database performance by telling MongoDB to physically organize and sort the index pointers using three specific fields in a defined order.
// This specific index is perfectly optimized for a "Notes Dashboard" query, where you need to fetch a specific user's notes, showing pinned notes at the very top, sorted from newest to oldest.
notesSchema.index({ user: 1, isPinned: -1, updatedAt: -1 })


export const Note = mongoose.model('Note', notesSchema)