import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../features/auth/auth.model.js';
import { getSession } from '../stores/redis.sessions.store.js';

export const socketAuthMiddleware = async (socket, next) => {
    try {
        // extract token from socket handshake auth object OR cookie header
        let token = socket.handshake.auth?.token;

        if (!token && socket.handshake.headers.cookie) {
            // parse cookies manually from handshake header
            const cookies = Object.fromEntries(
                socket.handshake.headers.cookie.split(';').map((c) => c.trim().split('='))
            )
            token = cookies.accessToken;
        }

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        // Verify JWT signature
        const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);

        // Verify Redis session is still active
        const activeSession = await getSession(decoded.sessionId);
        if (!activeSession || activeSession.userId !== decoded.userId) {
            return next(new Error('Authentication error: Session expired or revoked'));
        }

        // fetch user from mongodb
        const user = await User.findById(decoded.userId).select('name email role avatar');
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        // Attach user and session to the socket instance
        socket.user = user;
        socket.sessionId = decoded.sessionId;

        next();
    } catch (error) {
        return next(new Error(`Authentication error: ${error.message}`));
    }
}