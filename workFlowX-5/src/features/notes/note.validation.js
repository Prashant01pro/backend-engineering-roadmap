import { z } from 'zod'

export const noteTitleSchema = z.string({ required_error: 'Note title is required' })
    .trim()
    .min(2, 'Note title must be at least 2 characters')
    .max(100, 'Note title must be less than 100 characters')

// schema for creating a note 
export const createNoteSchema = z.object({
    title: noteTitleSchema,

    content: z.string({ required_error: 'Note content is required' })
        .trim()
        .min(1, 'Note content cannot be empty')
        .max(5000, 'Note content must be less than 5000 characters'),

    tags: z.array(z.string().trim().lowercase().max(30, 'Tag must be less than 30 characters'))
        .optional()
        .default([]),

    isPinned: z.boolean().optional().default(false),
    project: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Project ID format')
        .nullable()
        .optional()

})

export const updateNoteSchema = createNoteSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'You must provide at least one field to update' });


export const noteIdParamsSchema=z.object({id:z.string().regex(/^[0-9a-fA-F]{24}$/,'Invalid Note Id format')})

