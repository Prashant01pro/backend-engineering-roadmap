import { sendMessageService } from './chat.service.js';
import { logger } from '../../config/logger.js';

export const registerChatHandlers = (io, socket) => {
    const userId = socket.user._id.toString();

    // join conversation room 
    socket.on('conversation:join', ({ conversationId }) => {
        if (!conversationId) return;
        socket.join(`conversation:${conversationId}`);
    })

    socket.on('conversation:leave', ({ conversationId }) => {
        if (!conversationId) return;
        socket.leave(`conversation:${conversationId}`);
    })

    //send message with acknowledgement pattern
    socket.on('message:send', async (payload, ackCallback) => {
        try {
            const { conversationId, content, messageType, evidenceId, clientTempId } = payload;

            // save to mongodb
            const message = await sendMessageService({ conversationId, content, messageType, evidenceId, clientTempId }, userId);

            // acknowledge sender with success status
            if (typeof ackCallback === 'function') {
                ackCallback({ status: 'ok', data: message })
            }

            // broadcast to everyone in the conversation room (including sender's other tabs)
            io.to(`conversation:${conversationId}`).emit('message:new', message)


        }
        catch (error) {
            logger.error({ err: error, userId }, 'Failed to process message:send');
            if (typeof ackCallback === 'function') {
                ackCallback({ status: 'error', message: error.message });
            }
        }
    });
}