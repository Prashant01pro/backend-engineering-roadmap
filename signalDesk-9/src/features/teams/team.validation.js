import { z } from 'zod';
import AppError from '../../utils/appError.js';

// Regex validator for MongoDB ObjectIds
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID format');

export const createTeamSchema = z.object({
    name: z.string({ required_error: 'Team name is required' })
        .trim()
        .min(2, 'Team name must be at least 2 characters')
        .max(50, 'Team name cannot exceed 50 characters'),
    description: z.string().trim().max(250).optional()
});

export const addMemberSchema = z.object({
    userId: objectIdSchema,
    role: z.enum(['lead', 'investigator', 'observer']).default('investigator')
});

export const updateMemberRoleSchema = z.object({
    role: z.enum(['lead', 'investigator', 'observer'], {
        required_error: 'Role is required'
    })
});

// Middleware helper to validate req.body against any Zod schema
export const validate = (schema) => (req, _, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const errorMessage = result.error.issues.map((issue) => issue.message).join(', ');
        return next(new AppError(errorMessage, 400));
    }

    req.body = result.data;
    next();
};