import { z } from 'zod'
import AppError from '../../utils/appError.js'

// reusable strong password policy for secureVault
export const passwordSchema = z.string({ required_error: 'Password is required' })
    .min(10, 'Password must be at least 10 characters long')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
    password: passwordSchema,
    bio: z.string().trim().max(250).optional()
})

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
    password: z.string().min(1, 'Password is required')
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema
})

export const resetPasswordSchema = z.object({
    newPassword: passwordSchema
})

// middleware helper to validate req.body against any zod schema
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const errorMessage = result.error.issues.map((issue) => issue.message).join(',')

        return next(new AppError(errorMessage, 400))
    }

    // Replace req.body with sanitized/trimmed data
    req.body = result.data;
    next()
}