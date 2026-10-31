import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
    {
        incident: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Incident',
            required: [true, 'Note must belong to an incident'],
            unique: true, // One shared investigation notebook per incident
            index: true
        },
        title: {
            type: String,
            default: 'Investigation Document',
            trim: true,
            maxLength: [100, 'Title cannot exceed 100 characters']
        },
        documentName: {
            type: String,
            required: true,
            unique: true // Unique room key for Hocuspocus: `incident:<id>:notes:<noteId>`
        },
        snapshotVersion: {
            type: Number,
            default: 1
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
)

const Note = mongoose.model("Note", noteSchema)
export default Note;