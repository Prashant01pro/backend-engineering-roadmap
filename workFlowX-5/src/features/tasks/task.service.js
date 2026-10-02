import AppError from "../../utils/appError.js"
import { Task } from "./task.model.js";
import { Project } from "../projects/project.model.js";

// Create a new task
// Verifies that the referenced project (if provided) belongs to the authenticated user
export const createTaskService = async (userId, taskData) => {
    //If linked to a project, ensure the project exists and belongs to this user

    if (taskData.project) {
        const projectExists = await Project.findOne({ _id: taskData.project, user: userId })
        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 400);
        }
    }

    //create the task attached to logged-in user
    const task = await Task.create({
        ...taskData,
        user: userId
    })

    return task
}

export const getAllTasksService = async (userId, query) => {

    // base filter:always isolate to the logged-in user
    const filter = { user: userId }

    //filter by status
    if (query.status) {
        filter.status = query.status
    }

    //filter by priority
    if (query.priority) {
        filter.priority = query.priority;
    }

    // filter by specific project
    // if (query.project) {
    //     filter.project = query.project
    // }

    // Handles specific project ID OR independent tasks (project=none)
    if (query.project === 'none' || query.project === 'null') {
        filter.project = null;
    } else if (query.project) {
        filter.project = query.project;
    }

    // search in title or description
    if (query.search) {
        filter.$or = [
            { title: { $regex: query.search, $options: 'i' } },
            { description: { $regex: query.search, $options: 'i' } }
        ]
    }

    // sorting :default (newest first)
    const sortBy = query.sort ? query.sort.split(',').join(' ') : '-createdAt'

    //pagination
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // execute query with .populate() and count in parallel
    const [tasks, totalTasks] = await Promise.all([
        Task.find(filter)
            .populate('project', 'title status') // joins project title and status
            .sort(sortBy)
            .skip(skip)
            .limit(limit),
        Task.countDocuments(filter)
    ])

    const totalPages = Math.ceil(totalTasks / limit);

    return {
        tasks,
        pagination: {
            totalTasks,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    }

}

export const getTaskByIdService = async (userId, taskId) => {
    const task = await Task.findOne({ _id: taskId, user: userId })
        .populate('project', 'title status');

    if (!task) {
        throw new AppError('Task not found', 404);
    }
    return task;
};

export const updateTaskService = async (userId, taskId, updateData) => {
    // If updating the project reference, verify the new project belongs to this user
    if (updateData.project) {
        const projectExists = await Project.findOne({ _id: updateData.project, user: userId })

        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 404);
        }
    }

    const task = await Task.findOneAndUpdate({ _id: taskId, user: userId }, updateData,
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).populate('project', 'title status')

    if (!task) {
        throw new AppError('Task not found', 404);
    }
    return task;
}

// delete task by id :ensuring ownership
export const deleteTaskService=async(userId,taskId)=>{
    const task=await Task.findOneAndDelete({_id:taskId,user:userId});

    if (!task) {
        throw new AppError('Task not found', 404);
    }
    return task;
}