import { catchAsync } from '../../utils/catchAsync.js'
import { createTaskService, deleteTaskService, getAllTasksService, getTaskByIdService, updateTaskService } from './task.service.js';

export const createTask = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const task = await createTaskService(userId, req.body);

    res.status(201).json({
        status: 'success',
        message: 'Task created successfully',
        data: { task }
    })
})

export const getAllTasks = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const result = await getAllTasksService(userId, req.query);

    res.status(200).json({
        status: 'success',
        ...result
    })
})

export const getTaskById = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const taskId = req.params.id;

    const task = await getTaskByIdService(userId, taskId);

    res.status(200).json({
        status: 'success',
        data: { task }
    })
})

export const updateTask = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const taskId = req.params.id;
    const task = await updateTaskService(userId, taskId, req.body)

    res.status(200).json({
        status: 'success',
        message: 'Task updated successfully',
        data: { task }
    })
})

export const deleteTask=catchAsync(async(req,res)=>{
    const userId=req.user._id
    const taskId=req.params.id;

    await deleteTaskService(userId,taskId);

    res.status(200).json({
        status:'success',
        message:'Task deleted successfully'
    })
})