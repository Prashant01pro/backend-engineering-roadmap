export const globalErrorHandler=(err,req,res,next)=>{

    const statusCode=err.statusCode ||500
    const status=err.status || 'Error'

    // full stack trace for development
    console.error(err.stack || err.message)

    res.status(statusCode).json({
        status,
        statusCode,
        message:err.message || 'Somethig went wrong on server side'
    })
}