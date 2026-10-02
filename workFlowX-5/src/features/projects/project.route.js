import express from 'express'
import { authenticate } from '../auth/auth.middleware.js'
import { validateBody, validateParams } from './project.middlewares.js'
import { createProject, deleteProject, getAllProjects, getProjectById, updateProject } from './project.controller.js'
import { createProjectSchema, projectIdParamSchema, updateProjectSchema } from './project.validation.js'

const router = express.Router()

router.use(authenticate)

router.route('/')
    .get(getAllProjects)
    .post(validateBody(createProjectSchema), createProject);

router.route('/:id')
    .all(validateParams(projectIdParamSchema))  // Validates :id for GET, PATCH, and DELETE
    .get(getProjectById)
    .patch(validateBody(updateProjectSchema), updateProject)
    .delete(deleteProject)



export default router