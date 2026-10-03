import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: [true, 'Transaction type must be either income or expense']
        },
        amount: {
            type: Number,
            required: [true, 'Please provide an amount'],
            min: [0.01, 'Amount must be greater than 0']
        },
        category: {
            type: String,
            required: [true, 'Please provide a category'],
            trim: true,
            minLength: 2,
            maxLength: 50
        },
        description: {
            type: String,
            trim: true,
            maxLength: 500
        },
        date: {
            type: Date,
            default: Date.now,
            required: [true, 'Please provide a transaction date']

        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            index: true   // Optional link to a project
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Transaction must belong to a user'],
            index: true
        }
    },
    {
        timestamps: true
    }
)

// Compound index: Fetch recent transactions for a user
transactionSchema.index({ user: 1, date: -1 })

// Compound index: Filter by type (e.g. all expenses) sorted by date
transactionSchema.index({ user: 1, type: 1, date: -1 })

export const Transaction = mongoose.model('Transaction', transactionSchema)