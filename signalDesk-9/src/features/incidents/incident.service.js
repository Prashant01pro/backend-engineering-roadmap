import Incident, { INCIDENT_STATUS } from './incident.model.js';
import Team from '../teams/team.model.js';
import User from '../auth/auth.model.js';
import AppError from '../../utils/appError.js';
import { sendNotificationService } from '../notifications/notification.service.js';
import { invalidateAnalyticsCache } from '../analytics/analytics.service.js';

// Valid status transitions map (FSM)
const VALID_TRANSITIONS = {
    [INCIDENT_STATUS.REPORTED]: [INCIDENT_STATUS.ACKNOWLEDGED],
    [INCIDENT_STATUS.ACKNOWLEDGED]: [INCIDENT_STATUS.INVESTIGATING],
    [INCIDENT_STATUS.INVESTIGATING]: [INCIDENT_STATUS.RESOLVED],
    [INCIDENT_STATUS.RESOLVED]: [INCIDENT_STATUS.CLOSED, INCIDENT_STATUS.INVESTIGATING],
    [INCIDENT_STATUS.CLOSED]: [INCIDENT_STATUS.INVESTIGATING] // Reopen allowed by lead
};

// Helper: Generate unique incident number (INC-YYYYMMDD-XXXX)
const generateIncidentNumber = async () => {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INC-${datePrefix}-${randomSuffix}`;
}

// create a incident 
export const createIncidentService = async (data, creatorId) => {
    const team = await Team.findById(data.assignedTeam);
    if (!team) {
        throw new AppError('Assigned team does not exist', 404);
    }

    // Verify creator is a member of the team
    const isMember = team.members.some((m) => m.user.toString() === creatorId.toString());
    if (!isMember) {
        throw new AppError('You must be a member of the team to create an incident for it', 403);
    }

    // if assignedTo is provided , ensure they belong to the team
    if (data.assignedTo) {
        const assigneeInTeam = team.members.some((m) => m.user.toString() === data.assignedTo.toString());

        if (!assigneeInTeam) {
            throw new AppError('Assigned investigator must belong to the assigned team', 400)
        }
    }

    const incidentNumber = await generateIncidentNumber();

    const incident = await Incident.create({
        ...data,
        incidentNumber,
        createdBy: creatorId,
        timeline: [
            {
                action: 'CREATED',
                performedBy: creatorId,
                details: { initialSeverity: data.severity }
            }
        ]
    });

    await invalidateAnalyticsCache(incident.assignedTeam);

    return incident;
}

// transition incident status( enforcing FSM rules)
export const updateIncidentStatusService = async (incidentId, { status: nextStatus, reason }, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
        throw new AppError('Incident not found', 404);
    }
    const currentStatus = incident.status;

    // guard: prevent redundant update
    if (currentStatus === nextStatus) {
        throw new AppError(`Incident is already in ${currentStatus} status`, 400);
    }

    // guard : enforce fsm transition
    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(nextStatus)) {
        throw new AppError(`Invalid status transition from ${currentStatus} to ${nextStatus}. Allowed transitions: ${allowedNextStatuses.join(', ') || 'None'}`, 400);
    }

    // authorization: if moving to closed or reopening from closed , require 'lead' role
    const team = await Team.findById(incident.assignedTeam);
    const userMember = team?.members.find((m) => m.user.toString() === userId.toString());

    if (!userMember) {
        throw new AppError('You do not belong to the team investigating this incident', 403);
    }

    if ((nextStatus === INCIDENT_STATUS.CLOSED || currentStatus === INCIDENT_STATUS.CLOSED) && userMember.role !== 'lead') {
        throw new AppError('Only team leads can close or reopen an incident', 403);
    }

    // Apply status update
    incident.status = nextStatus;

    await invalidateAnalyticsCache(incident.assignedTeam);

    if (nextStatus === INCIDENT_STATUS.RESOLVED) {
        incident.resolvedAt = new Date();
    } else if (nextStatus === INCIDENT_STATUS.CLOSED) {
        incident.closedAt = new Date();
    }

    // Record timeline audit entry
    incident.timeline.push({
        action: 'STATUS_CHANGED',
        performedBy: userId,
        details: { from: currentStatus, to: nextStatus, reason: reason || null }
    });

    await incident.save({ validateBeforeSave: false });
    return incident;
}

// Assign an investigator
export const assignIncidentService = async (incidentId, assigneeId, requesterId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', 404);

    const team = await Team.findById(incident.assignedTeam);
    const requesterMember = team?.members.find((m) => m.user.toString() === requesterId.toString());

    if (!requesterMember || requesterMember.role === 'observer') {
        throw new AppError('Only leads and investigators can assign an incident', 403);
    }

    const assigneeMember = team?.members.find((m) => m.user.toString() === assigneeId.toString());
    if (!assigneeMember) {
        throw new AppError('Assigned investigator must belong to the incident team', 400);
    }

    incident.assignedTo = assigneeId;
    incident.timeline.push({
        action: 'ASSIGNED',
        performedBy: requesterId,
        details: { assignedTo: assigneeId }
    });

    await incident.save({ validateBeforeSave: false });

    await sendNotificationService({
        recipient: assigneeId,
        actor: requesterId,
        type: 'INCIDENT_ASSIGNED',
        resourceId: incident._id,
        resourceType: 'Incident',
        title: `Assigned: ${incident.incidentNumber}`,
        message: `You were assigned as lead investigator for incident: "${incident.title}"`
    });

    return incident.populate('assignedTo', 'name email avatar');
};

// Add a comment to an incident
export const addCommentService = async (incidentId, content, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', 404);

    incident.comments.push({
        user: userId,
        content
    });

    incident.timeline.push({
        action: 'COMMENT_ADDED',
        performedBy: userId,
        details: { preview: content.slice(0, 50) }
    });

    await incident.save({ validateBeforeSave: false });
    return incident.populate('comments.user', 'name email avatar');
};

// Query incidents with filtering and pagination
export const listIncidentsService = async (query) => {
    const { page, limit, status, severity, assignedTeam, assignedTo } = query;
    const filter = {};

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (assignedTeam) filter.assignedTeam = assignedTeam;
    if (assignedTo) filter.assignedTo = assignedTo;

    const skip = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
        Incident.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('assignedTeam', 'name slug')
            .populate('assignedTo', 'name email avatar')
            .populate('createdBy', 'name email'),
        Incident.countDocuments(filter)
    ]);

    return {
        incidents,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};
//Get single incident details
export const getIncidentByIdService = async (incidentId) => {

    const incident = await Incident.findById(incidentId)
        .populate('assignedTeam', 'name slug members')
        .populate('assignedTo', 'name email avatar bio')
        .populate('createdBy', 'name email')
        .populate('comments.user', 'name email avatar')
        .populate('timeline.performedBy', 'name email');

    if (!incident) {
        throw new AppError('Incident not found', 404);
    }
    return incident;
};