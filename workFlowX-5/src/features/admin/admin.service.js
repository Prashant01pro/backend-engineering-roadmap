import AppError from '../../utils/appError.js';
import User from '../auth/auth.model.js';
import { Project } from '../projects/project.model.js';
import { Task } from '../tasks/task.model.js';
import { Note } from '../notes/note.model.js';
import { Transaction } from '../transactions/transaction.model.js';

// system wise statistics for the entire platform

export const getSystemStatsService = async () => {
    const [totalUsers, totalProjects, totalTasks, totalNotes, totalTransactions, financialVolume] = await Promise.all([
        User.countDocuments(),
        Project.countDocuments(),
        Task.countDocuments(),
        Note.countDocuments(),
        Transaction.countDocuments(),
        Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalVolume: { $sum: '$amount' }
                }
            }
        ])
    ]);

    return {
        totalUsers,
        totalProjects,
        totalTasks,
        totalNotes,
        totalTransactions,
        totalPlatformVolume: financialVolume[0]?.totalVolume || 0
    }
}

// get all users with search, role filter and pagination
export const getAllUsersService = async (query) => {
    const filter = {}

    if (query.role) {
        filter.role = query.role;
    }

    if (query.search) {
        filter.$or = [
            { name: { $regex: query.search, $options: 'i' } },
            { email: { $regex: query.search, $options: 'i' } }
        ];
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
        User.find(filter)
            .select('-password -resetPasswordToken -resetPasswordExpires')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit),
        User.countDocuments(filter)
    ])

    const totalPages = Math.ceil(totalUsers / limit)

    return {
        users,
        pagination: {
            totalUsers,
            totalPages,
            currentPage: page,
            limit
        }
    };
}

// get single user details and their resource counts
export const getUserDetailsByIdService = async (targetUserId) => {
    const user = await User.findById(targetUserId).select('-password');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const [projectsCount, tasksCount, notesCount, transactionsCount] = await Promise.all([
        Project.countDocuments({ user: targetUserId }),
        Task.countDocuments({ user: targetUserId }),
        Note.countDocuments({ user: targetUserId }),
        Transaction.countDocuments({ user: targetUserId })
    ]);

    return {
        user,
        resourceSummary: {
            projectsCount,
            tasksCount,
            notesCount,
            transactionsCount
        }
    };
}

// Update user role (promote/demote)

export const updateUserRoleService = async (targetUserId, currentAdminId, newRole) => {
    // safety check :prevent admin from modify their own role
    if (targetUserId.toString() === currentAdminId.toString()) {
        throw new AppError('You cannot change your own role', 400);
    }

    if (!['user', 'admin'].includes(newRole)) {
        throw new AppError('Role must be either user or admin', 400);
    }

    //In Mongoose, findOneAndDelete expects a query filter object like { _id: id }, while findByIdAndDelete accepts the raw ID string directly
    const user = await User.findByIdAndUpdate(targetUserId, { role: newRole },
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).select('-password')

    if (!user) {
        throw new AppError('User not found', 404);
    }
    return user;
}

//Delete user and cascade delete all their data

export const deleteUserCascadeService = async (targetUserId, currentAdminId) => {
    // Safety check: Prevent admin from deleting themselves
    if (targetUserId.toString() === currentAdminId.toString()) {
        throw new AppError('You cannot delete your own admin account', 400);
    }

    //In Mongoose, findOneAndDelete expects a query filter object like { _id: id }, while findByIdAndDelete accepts the raw ID string directly
    const user = await User.findByIdAndDelete(targetUserId);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Cascade deletion of all associated documents
    await Promise.all([
        Project.deleteMany({ user: targetUserId }),
        Task.deleteMany({ user: targetUserId }),
        Note.deleteMany({ user: targetUserId }),
        Transaction.deleteMany({ user: targetUserId })
    ]);


    return user;
};

//Admin force delete any project
export const adminDeleteProjectService = async (projectId) => {

    const project = await Project.findByIdAndDelete(projectId);

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // delete any tasks that belonged to this project
    await Task.deleteMany({ project: projectId });
    return project;
};

// Admin force delete any task
export const adminDeleteTaskService = async (taskId) => {

    const task = await Task.findByIdAndDelete(taskId);

    if (!task) {
        throw new AppError('Task not found', 404);
    }

    return task;
};