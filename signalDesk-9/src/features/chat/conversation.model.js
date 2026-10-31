import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['incident', 'direct'],
            required: true
        },
        incident: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Incident',
            default: null,
            index: true
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        ],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null
        },
        lastMessageAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ incident: 1, type: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;