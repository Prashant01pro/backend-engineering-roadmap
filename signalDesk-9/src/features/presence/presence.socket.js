// Handles connection lifecycle, room joins, and temporary typing indicators.

import { trackSocketConnect, trackSocketDisconnect } from './presence.service.js';
import { logger } from '../../config/logger.js';

// Map to store typing timeout timers: `${incidentId}:${userId}` -> setTimeout
const typingTimers = new Map();

export const registerPresenceHandlers = (io, socket) => {
    const userId = socket.user._id.toString();
    const userName = socket.user.name;

    // CONNECTION LIFECYCLE
    // User automatically joins their private personal room
    socket.join(`user:${userId}`);

    // Track active socket in multi-tab presence engine
    trackSocketConnect(userId, socket.id).then(({ isFirstConnection }) => {
        if (isFirstConnection) {
            logger.info({ userId, userName }, 'Investigator came ONLINE');

            // broadcast to all connected clients that this user is online
            socket.broadcast.emit('presence:status', {
                userId,
                name: userName,
                status: 'online'
            });
        }
    });

    //INCIDENT WORKSPACE ROOMS
    socket.on('incident:join', ({ incidentId }) => {
        if (!incidentId) return;

        const roomName = `incident:${incidentId}`;
        socket.join(roomName);
        logger.debug({ userId, incidentId }, 'User joined incident room')
    })

    socket.on('incident:leave', ({ incidentId }) => {
        if (!incidentId) return;
        const roomName = `incident:${incidentId}`;
        socket.leave(roomName);
    });

    // EPHEMERAL TYPING INDICATORS
    socket.on('typing:start', ({ incidentId }) => {
        if (!incidentId) return;
        const timerKey = `${incidentId}:${userId}`;

        // Clear any existing timeout for this user in this incident
        if (typingTimers.has(timerKey)) {
            clearTimeout(typingTimers.get(timerKey));
        }

        // Broadcast to other investigators in the incident room
        socket.to(`incident:${incidentId}`).emit('typing:status', {
            incidentId,
            userId,
            name: userName,
            isTyping: true
        })

        // Safety timeout: Auto-clear typing indicator after 4 seconds of inactivity
        const timer = setTimeout(() => {
            socket.to(`incident:${incidentId}`).emit('typing:status', {
                incidentId,
                userId,
                name: userName,
                isTyping: false
            });
            typingTimers.delete(timerKey)
        }, 4000)
        typingTimers.set(timerKey, timer)
    });

    socket.on('typing:stop', ({ incidentId }) => {
        if (!incidentId) return;
        const timerKey = `${incidentId}:${userId}`;

        if (typingTimers.has(timerKey)) {
            clearTimeout(typingTimers.get(timerKey));
            typingTimers.delete(timerKey);
        }

        socket.to(`incident:${incidentId}`).emit('typing:status', {
            incidentId,
            userId,
            name: userName,
            isTyping: false
        });
    });

    // DISCONNECT HANDLER
    socket.on('disconnect', async () => {
        const { isLastConnection, lastSeen } = await trackSocketDisconnect(userId, socket.id);

        if (isLastConnection) {
            logger.info({ userId, userName }, 'Investigator went OFFLINE');
            socket.broadcast.emit('presence:status', {
                userId,
                name: userName,
                status: 'offline',
                lastSeen
            });
        }
    });
};