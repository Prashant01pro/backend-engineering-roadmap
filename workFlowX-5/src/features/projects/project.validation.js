import { z } from 'zod'

// no need to use required because zod has default feature required() and if want optional then use .optional()
export const titleSchema = z
    .string()
    .trim()
    .min(2, 'title must be greater than 2 characters')
    .max(150, 'title must be less than 150 characters')

// Schema for creating a project (POST /api/v1/projects)
export const createProjectSchema = z.object({
    title: titleSchema,

    description: z.string({ required_error: 'Description is required' })
        .trim()
        .max(500, 'Description must be less than 500 characters'),

    techStack: z.array(z.string().trim().max(50, 'Tech stack item must be under 50 characters'))
        .optional()
        .default([]),

    nonTechStack: z.array(z.string().trim().max(50, 'Non-tech stack item must be under 50 characters'))
        .optional()
        .default([]),

    status: z.enum(['active', 'paused', 'completed', 'archived'], { errorMap: () => ({ message: 'Status must be active, paused, completed, or archived' }) })
        .default('active'),

    //Use z.coerce.date() to automatically parse ISO strings into JavaScript Date objects, and can make it optional
    deadline: z.coerce.date({
        required_error:'Deadline is required',
        invalid_type_error:'Deadline must be a valid data'
    })
})


// Schema for updating a project (PATCH /api/v1/projects/:id)
// .partial() makes all fields optional, while preserving the validation rules if present


export const updateProjectSchema = createProjectSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'You must provide one field to update' });

// Schema for validating MongoDB ObjectId in route params
export const projectIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Project ID format')
})