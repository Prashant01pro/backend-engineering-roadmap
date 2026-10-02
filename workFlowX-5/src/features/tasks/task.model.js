import mongoose from 'mongoose'

const tasksSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please provide a task title'],
            trim: true,
            minLength: 2,
            maxLength: 150
        },
        description: {
            type: String,
            trim: true,
            maxLength: 500
        },
        status: {
            type: String,
            enum: ['todo', 'in_progress', 'completed'],
            default: 'todo'
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        dueDate: {
            type: Date
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            index: true // Fast lookup when fetching tasks by project
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Task must belong to a user'],
            index: true // fast lookup for multi-tenant isolation
        }
    },
    {
        timestamps: true
    }
)

export const Task=mongoose.model('Task',tasksSchema)