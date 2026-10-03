import mongoose from 'mongoose';
import { Project } from '../projects/project.model.js';
import { Task } from '../tasks/task.model.js';
import { Note } from '../notes/note.model.js';
import { Transaction } from '../transactions/transaction.model.js';

export const getDashboardStatsService = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    // run all aggregation and count queries concurrently in parallel

    const [projectStats, taskStats, overdueTasksCount, noteStats, financialTotals, upcomingTasks] = await Promise.all([
        // Project breakdown by Status
        Project.aggregate([
            { $match: { user: userObjectId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]),

        // Tasks Breakdown by Status
        Task.aggregate([
            { $match: { user: userObjectId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]),

        //Overdue Tasks (dueDate in the past and not completed)
        Task.countDocuments({
            user: userId,
            dueDate: { $lt: now },
            status: { $ne: 'completed' }
        }),

        //Notes Stats (total and pinned)
        Note.aggregate([
            { $match: { user: userObjectId } },
            {
                $group: {
                    _id: null,
                    totalNotes: { $sum: 1 },
                    pinnedNotes: {
                        $sum: { $cond: [{ $eq: ['$isPinned', true] }, 1, 0] }
                    }
                }
            }
        ]),

        // Financial Totals (Income vs Expense)
        Transaction.aggregate([
            { $match: { user: userObjectId } },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]),

        //Top 5 Upcoming Tasks
        Task.find({ user: userId, status: { $ne: 'completed' } })
            .sort({ dueDate: 1 })
            .limit(5)
            .populate('project', 'title')
    ]);

    // format project stats
    const projects = { total: 0, active: 0, completed: 0, paused: 0, archived: 0 }

    projectStats.forEach((stat) => {
        projects.total += stat.count;
        if (projects[stat._id] !== undefined) {
            projects[stat._id] = stat.count;
        }
    })

    // Format Task Stats
    const tasks = { total: 0, todo: 0, in_progress: 0, completed: 0, overdue: overdueTasksCount };

    taskStats.forEach((stat) => {
        tasks.total += stat.count;
        if (tasks[stat._id] !== undefined) {
            tasks[stat._id] = stat.count;
        }
    });

    // Format Notes Stats
    const notes = {
        total: noteStats[0]?.totalNotes || 0,
        pinned: noteStats[0]?.pinnedNotes || 0
    };

    // Format Finances
    let totalIncome = 0;
    let totalExpense = 0;

    financialTotals.forEach((item) => {
        if (item._id === 'income') totalIncome = item.totalAmount;
        if (item._id === 'expense') totalExpense = item.totalAmount;
    });

    return {
        projects,
        tasks,
        notes,
        finances: {
            totalIncome,
            totalExpense,
            netBalance: totalIncome - totalExpense
        },
        upcomingTasks
    };

}