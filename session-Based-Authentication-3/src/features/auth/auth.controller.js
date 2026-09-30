import { catchAsync } from '../../utils/catchAsync.js'
import { loginService, logoutService, registerService } from './auth.services.js'
import { destroyAllUserSessionsService, destroySpecificSessionService, getAllUserSessionsService } from './session.service.js'

export const register = catchAsync(async (req, res) => {

    const user = await registerService(req.body)

    res.status(201).json({
        message: 'User registration successful',
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

export const login = catchAsync(async (req, res) => {

    const metadata = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress
    }

    const { user, session } = await loginService(req.body,metadata)

    res.cookie('sessionId', session.sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    })

    res.status(200).json({
        message: 'user login successful',
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })

})

export const logout = catchAsync(async (req, res) => {
    const sessionId = req.cookies?.sessionId || req.headers?.sessionid

    await logoutService(sessionId)

    res.clearCookie('sessionId', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'

    })

    res.status(200).json({
        message: 'User logout successfully'
    })
})

export const getAllSessions=catchAsync(async(req,res)=>{
    const userId=req.session.userId;

    const sessions=await getAllUserSessionsService(userId)

    res.status(200).json({
        sessions
    })
})

export const logoutAll=catchAsync(async(req,res)=>{
    const userId=req.session.userId;
    
    await destroyAllUserSessionsService(userId)

    res.clearCookie('sessionId',{
        httpOnly:true,
        secure:false,
        sameSite:'lax',
        path:'/'
    })

    res.status(200).json({
        message:'Logout out from all devices successfully'
    })

})

export const logoutSpecificSession=catchAsync(async(req,res)=>{
    const userId=req.session.userId;
    const sessionId=req.params.sessionId

    await destroySpecificSessionService(userId,sessionId)

    res.status(200).json({
        message:'Session revoked successfully'
    })
})