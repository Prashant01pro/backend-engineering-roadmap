import Conversation from './conversation.model.js';
import Message from './message.model.js';
import Incident from '../incidents/incident.model.js';
import Team from '../teams/team.model.js';
import AppError from '../../utils/appError.js';

// get or auto-create an incident group conversion
export const getOrCreateIncidentConversation = async (incidentId, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', 404);

    const team = await Team.findById(incident.assignedTeam);
    const isMember = team?.members.some((m) => m.user.toString() === userId.toString());
    if (!isMember) {
        throw new AppError('You do not have access to this incident conversation', 403);
    }

    let conversation = await Conversation.findOne({ incident: incidentId, type: 'incident' });
    if (!conversation) {
        const teamMemberIds = team.members.map((m) => m.user);
        conversation = await Conversation.create({
            type: 'incident',
            incident: incidentId,
            participants: teamMemberIds
        })
    }

    return conversation;

}

// get or create a 1 to 1 direct conversation between two users
export const getOrCreateDirectConversation = async (userAId, userBId) => {
    if (userAId.toString() === userBId.toString()) {
        throw new AppError('Cannot start a direct conversation with yourself', 400)
    }

    let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [userAId, userBId], $size: 2 }
    })

    if (!conversation) {
        conversation = await Conversation.create({
            type: 'direct',
            participants: [userAId, userBId]
        });
    }

    return conversation.populate('participants', 'name email avatar');
}

// Persist-then-broadcast message creation
export const sendMessageService = async ({ conversationId, content, messageType, evidenceId, clientTempId }, senderId) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    // Verify sender is an authorized participant
    const isParticipant = conversation.participants.some((p) => p.toString() === senderId.toString())
    if (!isParticipant) {
        throw new AppError('You are not a participant in this conversation', 403);
    }

    // Idempotency: Check if clientTempId was already processed within last minute
    if (clientTempId) {
        const duplicate = await Message.findOne({
            conversation: conversationId,
            clientTempId,
            sender: senderId
        })

        if (duplicate) {
            return duplicate; // Safely return previously created message
        }
    }

    // Persist message in MongoDB
    const message = await Message.create({
        conversation: conversationId,
        sender: senderId,
        content,
        messageType: messageType || 'text',
        evidence: evidenceId || null,
        clientTempId: clientTempId || null,
        readBy: [{ user: senderId, readAt: new Date() }]
    });

    // Update conversation's last message timestamp
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save({ validateBeforeSave: false });

    return message.populate('sender', 'name email avatar');
}

// Keyset / Cursor Pagination for message history
export const getConversationMessagesService = async (conversationId, { before, limit = 30 }, userId) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    const isParticipant = conversation.participants.some((p) => p.toString() === userId.toString());
    if (!isParticipant) {
        throw new AppError('Access denied: You are not a participant', 403);
    }

    const query = { conversation: conversationId };

    if (before) {
        query.createdAt = { $lt: new Date(before) }; // Fetch older messages before cursor
    }
    const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .populate('sender', 'name email avatar')
        .populate('evidence', 'thumbnailUrl displayUrl caption');

    // Return chronological order to client
    return messages.reverse();
};