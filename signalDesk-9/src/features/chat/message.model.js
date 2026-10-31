import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
            index: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: [true, 'Message content cannot be empty'],
            trim: true,
            maxLength: [4000, 'Message cannot exceed 4000 characters']
        },
        messageType: {
            type: String,
            enum: ['text', 'evidence'],
            default: 'text'
        },
        evidence: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Evidence',
            default: null
        },
        clientTempId: {
            type: String, // Client-supplied UUID to avoid duplicate submissions on retries
            default: null,
            index: true
        },
        readBy: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                readAt: { type: Date, default: Date.now }
            }
        ]
    },
    {
        timestamps: true
    }
);

// Compound index for keyset/cursor pagination: newest messages first
messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;