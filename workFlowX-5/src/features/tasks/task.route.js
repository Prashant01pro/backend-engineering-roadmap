import express from 'express'
import { authenticate } from '../auth/auth.middleware.js'
import { validateBody, validateParam } from './task.middleware.js'
import { createTask, deleteTask, getAllTasks, getTaskById, updateTask } from './task.controller.js'
import { createTaskSchema,updateTaskSchema, taskIdParamSchema} from './task.validation.js'

const router = express.Router()

router.use(authenticate)

// Collection routes (/)
router.route('/')
.get(getAllTasks)
.post(validateBody(createTaskSchema),createTask)

router.route('/:id')
.all(validateParam(taskIdParamSchema)) // Validates :id for GET, PATCH, DELETE
.get(getTaskById)
.patch(validateBody(updateTaskSchema),updateTask)
.delete(deleteTask)

export default router;