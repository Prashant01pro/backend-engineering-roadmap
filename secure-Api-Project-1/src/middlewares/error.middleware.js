export const globalErrorMiddleware = (err, req, res, next) => {

    const statusCode = err.statusCode || 500;
    const status = err.status || 'Error';

    //Log the full stack trace for development/debugging
    console.error('Error: ', err.stack || err.message);

    //Explicitly chain .status() before sending .json()
    res.status(statusCode).json({
        status,
        statusCode,
        message: err.message || 'Something went wrong on server side'
        //Optional: Hide stack trace in production using process.env.NODE_ENV
        //    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })

    })

}