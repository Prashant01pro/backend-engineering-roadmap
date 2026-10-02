import { Project } from "./project.model.js"
import AppError from '../../utils/appError.js'

// creating project service attached to authenticated User
export const createProjectService = async (userId, projectData) => {
    const project = await Project.create({
        ...projectData,
        user: userId
    })

    return project;
}

// get all projects for the user with search , filter, sort , pagination
export const getAllProjectsService = async (userId, query) => {

    // base filter: always strict to logged-in user
    const filter = { user: userId }

    // status filter
    if (query.status) {
        filter.status = query.status
    }

    // search filter (matches title or description case-insensitively)
    if (query.search) {
        filter.$or = [
            { title: { $regex: query.search, $options: 'i' } },
            { description: { $regex: query.search, $options: 'i' } }
        ]
    }

    // sorting default-newest first
    const sortBy = query.sort ? query.sort.split(',').join(' ') : '-createdAt';

    // pagination
    const page = Math.max(1, parseInt(query.page, 10) || 1);

    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10)); // max limit 100
    const skip = (page - 1) * limit;

    // execute queries in parallel for high performance
    const [projects, totalProjects] = await Promise.all([Project.find(filter).sort(sortBy).skip(skip).limit(limit), Project.countDocuments(filter)])

    const totalPages = Math.ceil(totalProjects / limit);

    return {
        projects,
        pagination: {
            totalProjects,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    }
}

// get a single project by id
export const getProjectByIdService = async (userId, projectId) => {
    const project = await Project.findOne({ _id: projectId, user: userId });

    if (!project) {
        throw new AppError('Project not found', 404);
    }
    return project;
}

// update project by Id
export const updateProjectService = async (userId, projectId, updateData) => {
    const project = await Project.findOneAndUpdate({ _id: projectId, user: userId }, updateData,
        {
            returnDocument: 'after',  // returns the updated document
            runValidators: true   // ensures schema validation still applies
        }
    )

    if (!project) {
        throw new AppError('Project not found', 404);
    }
    return project;
}

//  Delete project by ID (ensuring ownership)
export const deleteProjectService = async (userId, projectId) => {
    const project = await Project.findOneAndDelete({ _id: projectId, user: userId });
    if (!project) {
        throw new AppError('Project not found', 404);
    }
    return project;
};