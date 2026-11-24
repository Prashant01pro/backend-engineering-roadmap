export const globalErrorMiddleware = (err, req, res, next) => {

    const statusCode=err.statusCode || 500;
    const status=err.status || 'Error';

    console.error(err.stack || err.message)

    res.status(statusCode).json({
        status,
        statusCode,
        message: err.message || 'Something went wrong on server side'
    })

}