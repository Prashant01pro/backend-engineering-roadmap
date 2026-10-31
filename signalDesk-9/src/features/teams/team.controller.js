import { catchAsync } from '../../utils/catchAsync.js';
import {createTeamService,getUserTeamsService,getTeamByIdService,addMemberService,removeMemberService} from './team.service.js';

export const createTeam = catchAsync(async (req, res) => {
    const team = await createTeamService(req.body, req.user._id);

    res.status(201).json({
        status: 'success',
        message: 'Team created successfully',
        data: { team }
    });
});

export const getMyTeams = catchAsync(async (req, res) => {
    const teams = await getUserTeamsService(req.user._id);

    res.status(200).json({
        status: 'success',
        results: teams.length,
        data: { teams }
    });
});

export const getTeamById = catchAsync(async (req, res) => {
    const team = await getTeamByIdService(req.params.id, req.user._id);

    res.status(200).json({
        status: 'success',
        data: { team }
    });
});

export const addMember = catchAsync(async (req, res) => {
    const team = await addMemberService(req.params.id, req.body, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Member added to team',
        data: { team }
    });
});

export const removeMember = catchAsync(async (req, res) => {
    const team = await removeMemberService(req.params.id, req.params.userId, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Member removed from team',
        data: { team }
    });
});