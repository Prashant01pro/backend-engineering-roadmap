import Team from './team.model.js';
import User from '../auth/auth.model.js';
import AppError from '../../utils/appError.js';
import { sendNotificationService } from '../notifications/notification.service.js';

// Utility helper to create a URL-safe slug from team name
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

// create a new team and add creator as lead
export const createTeamService = async ({ name, description }, creatorId) => {
    const slug = generateSlug(name);

    // Check if team name or slug already exists
    const existingTeam = await Team.findOne({ $or: [{ name }, { slug }] });
    if (existingTeam) {
        throw new AppError('A team with this name already exists', 409);
    }

    const team = await Team.create({
        name,
        slug,
        description,
        createdBy: creatorId,
        members: [
            {
                user: creatorId,
                role: 'lead',
                joinedAt: new Date()
            }
        ]
    });
    return team;
}

// fetch all teams the logged-in user belongs to
export const getUserTeamsService = async (userId) => {
    const teams = await Team.find({ 'members.user': userId })
        .populate('members.user', 'name email avatar')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 })

    return teams;
}

// fetch single team by ID (ensuring requester is a member)
export const getTeamByIdService = async (teamId, userId) => {
    const team = await Team.findById(teamId)
        .populate('members.user', 'name email avatar bio')
        .populate('createdBy', 'name email');

    if (!team) {
        throw new AppError('Team not found', 404);
    }

    // Authorization check: User must be a member of the team
    const isMember = team.members.some((m) => m.user._id.toString() === userId.toString());
    if (!isMember) {
        throw new AppError('Access denied: You are not a member of this team', 403);
    }

    return team;
};

//Add a member to the team (Requester must be a 'lead')
export const addMemberService = async (teamId, { userId, role }, requesterId) => {

    const team = await Team.findById(teamId);
    if (!team) {
        throw new AppError('Team not found', 404);
    }

    // Verify requester has 'lead' role
    const requesterMember = team.members.find((m) => m.user.toString() === requesterId.toString());
    if (!requesterMember || requesterMember.role !== 'lead') {
        throw new AppError('Only team leads can add new members', 403);
    }

    // Verify target user exists in database
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
        throw new AppError('User to add does not exist', 404);
    }

    // Check if user is already in the team
    const alreadyMember = team.members.some((m) => m.user.toString() === userId.toString());
    if (alreadyMember) {
        throw new AppError('User is already a member of this team', 400);
    }

    // Add new member
    team.members.push({ user: userId, role });
    await team.save({ validateBeforeSave: false });

    await sendNotificationService({
        recipient: userId,
        actor: requesterId,
        type: 'TEAM_INVITE',
        resourceId: team._id,
        resourceType: 'Team',
        title: `Team Invitation: ${team.name}`,
        message: `You were added to the investigation team "${team.name}" as an ${role}`
    });

    return team.populate('members.user', 'name email avatar');
};

// Remove a member from the team
export const removeMemberService = async (teamId, targetUserId, requesterId) => {
    const team = await Team.findById(teamId);
    if (!team) {
        throw new AppError('Team not found', 404);
    }

    const requesterMember = team.members.find((m) => m.user.toString() === requesterId.toString());
    const isSelfRemoval = targetUserId.toString() === requesterId.toString();


    // Only a 'lead' can remove someone else; anyone can remove themselves (leave team)
    if (!isSelfRemoval && (!requesterMember || requesterMember.role !== 'lead')) {
        throw new AppError('Only team leads can remove members from this team', 403);
    }

    // Guard: Prevent removing the only lead from the team
    const targetMember = team.members.find((m) => m.user.toString() === targetUserId.toString());

    if (!targetMember) {
        throw new AppError('Member not found in this team', 404);
    }

    if (targetMember.role === 'lead') {
        const leadCount = team.members.filter((m) => m.role === 'lead').length;
        if (leadCount <= 1) {
            throw new AppError('Cannot remove the last lead of the team. Assign another lead first.', 400);
        }
    }

    // Pull member
    team.members = team.members.filter((m) => m.user.toString() !== targetUserId.toString());
    await team.save({ validateBeforeSave: false });

    return team;
};