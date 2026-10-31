import { z } from "zod";
import AppError from "../../utils/appError.js";
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from './incident.model.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID format');

export const createIncidentSchema = z.object({
    title: z.string({ required_error: 'Title is required' })
        .trim()
        .min(5, 'Title must be at least 5 characters')
        .max(150, 'Title cannot exceed 150 characters'),

    description: z.string({ required_error: 'Description is required' })
        .trim()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters'),

    severity: z.enum(Object.values(INCIDENT_SEVERITY)).default(INCIDENT_SEVERITY.MEDIUM),
    assignedTeam: objectIdSchema,
    assignedTo: objectIdSchema.optional()
});

export const updateIncidentStatusSchema = z.object({
    status: z.enum(Object.values(INCIDENT_STATUS), {
        required_error: 'Target status is required'
    }),
    reason: z.string().trim().max(500).optional()
});

export const assignIncidentSchema = z.object({
    assignedTo: objectIdSchema
});

export const addCommentSchema = z.object({
    content: z.string({ required_error: 'Comment cannot be empty' })
        .trim()
        .min(1, 'Comment cannot be empty')
        .max(1000, 'Comment cannot exceed 1000 characters')
});

export const listIncidentsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(Object.values(INCIDENT_STATUS)).optional(),
    severity: z.enum(Object.values(INCIDENT_SEVERITY)).optional(),
    assignedTeam: objectIdSchema.optional(),
    assignedTo: objectIdSchema.optional()
});

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const errorMessage = result.error.issues.map((i) => i.message).join(', ');
        return next(new AppError(errorMessage, 400));
    }
    req.body = result.data;
    next();
};

export const validateQuery = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
        const errorMessage = result.error.issues.map((i) => i.message).join(', ');
        return next(new AppError(errorMessage, 400));
    }
    // Express 4/5 defines req.query with a getter on IncomingMessage without a setter.
    // Instead of replacing req.query reference, mutate existing properties in-place and attach validatedQuery.
    for (const key of Object.keys(req.query)) {
        delete req.query[key];
    }
    Object.assign(req.query, result.data);
    req.validatedQuery = result.data;
    next();
};
