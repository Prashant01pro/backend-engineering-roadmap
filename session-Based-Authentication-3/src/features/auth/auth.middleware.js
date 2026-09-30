import AppError from "../../utils/appError.js"
import { destroySession, getUserSession } from "./session.service.js"


export const authenticate = async (req, res, next) => {
    const sessionId = req.cookies?.sessionId || req.headers?.sessionid

    if (!sessionId) {
        return next(new AppError('Invalid user session and credientials', 400))
    }

    const userSession = await getUserSession(sessionId)

    if (!userSession || Date.now() > new Date(userSession.expiresAt).getTime()) {

        if (sessionId) {
            await destroySession(sessionId)

            res.clearCookie('sessionId', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/'
            })
        }
        return next(new AppError('Session expired or invalid, please log in again', 401))
    }

       // Device Fingerprint check (Session Hijacking prevention)
       //Now that we know userSession exists, check for Session Hijacking
       
    const currentUserAgent = req.headers['user-agent']
    if (userSession.userAgent && userSession.userAgent !== currentUserAgent) {
        if (sessionId) {
            await destroySession(sessionId)
            res.clearCookie('sessionId', { path: '/' })
        }
        return next(new AppError('Suspicious activity detected: Session hijacked. Please log in again', 401))
    }

    req.session = userSession

    next()



}