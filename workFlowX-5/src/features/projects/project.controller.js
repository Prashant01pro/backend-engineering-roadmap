import { catchAsync } from '../../utils/catchAsync.js'
import { createProjectService, deleteProjectService, getAllProjectsService, getProjectByIdService, updateProjectService } from './project.service.js';

export const createProject = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const project = await createProjectService(userId, req.body)

    res.status(201).json({
        status: 'success',
        message: 'Project created successfully',
        data: { project }
    })
})

export const getAllProjects = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const result = await getAllProjectsService(userId, req.query);

    // use the spread operator (...result) instead of returning result directly because result is an object, and you want to flatten its properties directly into the response object rather than nesting it under a new key.
    res.status(200).json({
        status: 'success',
        ...result
    })
})

export const getProjectById = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const projectId = req.params.id;

    const project = await getProjectByIdService(userId, projectId);

    res.status(200).json({
        status: 'success',
        data: { project }
    })
});

export const updateProject = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const projectId = req.params.id

    const project = await updateProjectService(userId, projectId, req.body)

    res.status(200).json({
        status: 'success',
        message: 'Project updated successfully',
        data: { project }
    })
})

export const deleteProject =catchAsync(async(req,res)=>{
    const userId=req.user._id;
    const projectId=req.params.id;

    await deleteProjectService(userId,projectId);

    res.status(200).json({
        status:'success',
        message:'Project deleted successfully'
    })
})