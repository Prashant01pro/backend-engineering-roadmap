class AppError extends Error {
    constructor(message, statusCode) {
        super(message)

        this.statusCode = statusCode
        this.status = `${statusCode}`.startsWith('4') ? 'Fail' : 'Error'
        this.isOperational = true

        // Captures the stack trace, keeping the constructor call out of it
        Error.captureStackTrace(this, this.constructor)

    }
}

export default AppError