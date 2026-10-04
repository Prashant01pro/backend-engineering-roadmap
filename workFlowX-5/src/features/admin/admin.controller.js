import { catchAsync } from '../../utils/catchAsync.js';
import { getSystemStatsService, getAllUsersService, getUserDetailsByIdService, updateUserRoleService, deleteUserCascadeService, adminDeleteProjectService, adminDeleteTaskService } from './admin.service.js';

export const getSystemStats = catchAsync(async (req, res) => {
    const stats = await getSystemStatsService();

    res.status(200).json({
        status: 'success',
        data: stats
    });
});

export const getAllUsers = catchAsync(async (req, res) => {
    const result = await getAllUsersService(req.query);

    res.status(200).json({
        status: 'success',
        ...result
    });
})

export const getUserDetails = catchAsync(async (req, res) => {
    const targetUserId = req.params.id;
    const userDetails = await getUserDetailsByIdService(targetUserId);

    res.status(200).json({
        status: 'success',
        data: userDetails
    });
});

export const updateUserRole = catchAsync(async (req, res) => {
    const targetUserId = req.params.id;
    const currentAdminId = req.user._id;
    const { role } = req.body;

    const updatedUser = await updateUserRoleService(targetUserId, currentAdminId, role);

    res.status(200).json({
        status: 'success',
        message: `User role successfully updated to ${role}`,
        data: { user: updatedUser }
    });
});

export const deleteUser = catchAsync(async (req, res) => {
    const targetUserId = req.params.id;
    const currentAdminId = req.user._id;

    await deleteUserCascadeService(targetUserId, currentAdminId);

    res.status(200).json({
        status: 'success',
        message: 'User and all associated data permanently deleted'
    });
});

export const adminDeleteProject = catchAsync(async (req, res) => {
    const projectId = req.params.id;
    await adminDeleteProjectService(projectId);

    res.status(200).json({
        status: 'success',
        message: 'Project and associated tasks deleted by admin'
    });
});

export const adminDeleteTask = catchAsync(async (req, res) => {
    const taskId = req.params.id;
    await adminDeleteTaskService(taskId);

    res.status(200).json({
        status: 'success',
        message: 'Task deleted by admin'
    });
});