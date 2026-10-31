import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerPresenceHandlers } from '../features/presence/presence.socket.js';
import { registerChatHandlers } from '../features/chat/chat.socket.js';

let io = null;

export const initSocketServer = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: env.FRONTEND_URL,
            credentials: true
        },

        // Enable Socket.IO Connection State Recovery for brief network drops
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
            skipMiddlewares: false
        }
    });

    // Register JWT authentication middleware on handshake
    io.use(socketAuthMiddleware);

    // Main connection event listener
    io.on('connection', (socket) => {
        logger.info({ socketId: socket.id, userId: socket.user._id }, 'New WebSocket connection authenticated');

        // Register feature socket handlers
        registerPresenceHandlers(io, socket);
        registerChatHandlers(io, socket);
    });
    return io;
}

// Export singleton getter so services (notifications, chat) can emit events
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO has not been initialized yet');
    }
    return io;
};