import { catchAsync } from '../../utils/catchAsync.js';
import { getOrCreateIncidentConversation, getOrCreateDirectConversation, getConversationMessagesService } from './chat.service.js';

export const getIncidentConversation = catchAsync(async (req, res) => {
    const conversation = await getOrCreateIncidentConversation(req.params.incidentId, req.user._id);

    res.status(200).json({
        status: 'success',
        data: { conversation }
    });
});

export const getDirectConversation = catchAsync(async (req, res) => {
    const conversation = await getOrCreateDirectConversation(req.user._id, req.params.recipientId);

    res.status(200).json({
        status: 'success',
        data: { conversation }
    });
});

export const getMessages = catchAsync(async (req, res) => {
    const messages = await getConversationMessagesService(
        req.params.conversationId,
        req.query,
        req.user._id
    );

    res.status(200).json({
        status: 'success',
        results: messages.length,
        data: { messages }
    });
});