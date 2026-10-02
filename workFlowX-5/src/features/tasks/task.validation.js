import { z } from 'zod'

export const taskTitleSchema = z.string({ required_error: 'Task title is required' })
    .trim()
    .min(2, 'Task title must be atleast 2 characters')
    .max(150, 'Task title must be less than 150')


// schema for creating a task
export const createTaskSchema = z.object({
    title: taskTitleSchema,
    description: z.string()
        .trim()
        .max(500, 'Description must be less than 500 characters')
        .optional(),
    status: z.enum(['todo', 'in_progress', 'completed'], { errorMap: () => ({ message: 'Status must be todo,in_progress, or completed' }) })
        .default('todo'),
    priority: z.enum(['low', 'medium', 'high'], { errorMap: () => ({ message: 'priority must be low , medium, or high' }) })
        .default('medium'),
    dueDate: z.coerce.date({ invalid_type_error: 'Due date must be a valid date' })
        .optional(),
    project: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Project ID format')
        .nullable()
        .optional()

})

// schema for updating a task
export const updateTaskSchema = createTaskSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'You must provide at least one field to update' })

// schema for validating Id parameter
export const taskIdParamSchema = z.object({
    id: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Task ID format')
})