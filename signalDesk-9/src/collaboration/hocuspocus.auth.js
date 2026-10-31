// When a client connects to ws://localhost:1234, Hocuspocus executes this hook to verify their JWT and incident team membership

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../features/auth/auth.model.js';
import Incident from '../features/incidents/incident.model.js';
import Team from '../features/teams/team.model.js';
import { getSession } from '../stores/redis.sessions.store.js';
import AppError from '../utils/appError.js';

export const authenticateHocuspocusConnection = async (data) => {
    const { token, documentName } = data;
    if (!token) {
        throw new Error('Authentication failed: Missing JWT token');
    }

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET)

    //Verify active Redis session
    const activeSession = await getSession(decoded.sessionId);
    if (!activeSession || activeSession.userId !== decoded.userId) {
        throw new AppError('Authentication failed: Session expired or revoked', 401);
    }

    // fetch user
    const user = await User.findById(decoded.userId).select('name email avatar role')
    if (!user) {
        throw new AppError('Authentication failed: User not found', 401);
    }

    // Validate Document Name Pattern: `incident:<incidentId>:notes:<noteId>`
    const parts = documentName.split(':');

    if (parts.length !== 4 || parts[0] !== 'incident' || parts[2] !== 'notes') {
        throw new AppError('Authorization failed: Invalid collaborative document identifier format', 401);
    }

    const incidentId = parts[1];

    //Verify User belongs to the Incident's assigned team
    const incident = await Incident.findById(incidentId);
    if (!incident) {
        throw new AppError('Authorization failed: Associated incident not found', 401);
    }

    const team = await Team.findById(incident.assignedTeam);
    const isMember = team?.members.some((m) => m.user.toString() === user._id.toString());
    if (!isMember) {
        throw new AppError('Authorization failed: You do not belong to the incident team', 401);
    }

    return {
        user: {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar?.url || null
        },
        incidentId,
        teamRole: team.members.find((m) => m.user.toString() === user._id.toString())?.role
    };
}