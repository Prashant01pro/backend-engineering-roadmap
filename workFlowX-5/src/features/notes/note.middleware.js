import AppError from '../../utils/appError.js'

export const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
        const errorMessage = result.error.issues.map((issue) => issue.message).join(',')

        return next(new AppError(errorMessage, 400))
    }

    req.body = result.data;
    next()
}

export const validateParams = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.params)

    if (!result.success) {
        const errorMessage = result.error.issues.map((issue) => issue.message).join(',');

        return next(new AppError(errorMessage,400))
    }
    req.params=result.data;
    next()
}