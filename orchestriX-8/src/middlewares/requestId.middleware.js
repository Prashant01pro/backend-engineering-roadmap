import crypto from 'crypto'

export const requestIdMiddleware=(req,res,next)=>{
    // reuse incoming request Id (from client / reverse proxy) or generate a new one
    const requestId=req.headers['x-request-id'] || crypto.randomUUID()

    req.id=requestId
    res.setHeader('X-Request-ID',requestId)
    next()
}