import AppError from "../../utils/appError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { changePasswordService, forgotPasswordService, getActiveSessionsService, loginServices, logoutServices, refreshServices, registerService, resetPasswordService, revokeAllSessionsService, revokeDeviceSessionService, updateUserService } from "./auth.services.js";

export const register = catchAsync(async (req, res) => {

    const { user, accessToken, refreshToken,sessionId } = await registerService(req.body,req)

    const cookieOptions={
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
    }
    // send accesstoken as httpOnly cookie
    res.cookie('accessToken', accessToken, {
       ...cookieOptions,
        maxAge: 15 * 60 * 1000
    });


    // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
       ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // sessionId 7days
    res.cookie('sessionId',sessionId,{
        ...cookieOptions,
        maxAge:7*24*60*60*1000
    })

    res.status(201).json({
        message: 'Registration Successful',
        accessToken,
        sessionId,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

export const login = catchAsync(async (req, res) => {

    const { user, accessToken, refreshToken,sessionId } = await loginServices(req.body,req)

    const cookieOptions={
        httpOnly:true,
        secure:false, // true in production
        sameSite:'lax'
    }

    // send accesstoken as httpOnly cookie
    res.cookie('accessToken', accessToken, {
       ...cookieOptions,
        maxAge: 15* 60 * 1000
    });


    // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie('sessionId',sessionId,{
        ...cookieOptions,
        maxAge:7*24*60*60*1000
    })

    res.status(201).json({
        message: 'login Successful',
        accessToken,
        sessionId,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

export const refresh=catchAsync(async(req,res,next)=>{
    const incomingRefreshToken=req.cookies?.refreshToken || req.body?.refresh
    const incomingSessionId=req.cookies?.sessionId || req.body?.sessionId

    if(!incomingRefreshToken || !incomingSessionId){
        return next(new AppError('Invalid session. Please login again.', 401))
    }

    const { newAccessToken,newRefreshToken,sessionId}=await refreshServices(incomingRefreshToken,incomingSessionId);

     const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }

    res.cookie('accessToken',newAccessToken,{
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
    })

     // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
        newAccessToken,
        message:'new Access token generated'
    })


})

export const myprofile=catchAsync(async(req,res )=>{
    // const user=await User.findById(req.user._id)

    res.status(200).json({
        user:req.user
    })
})

export const updateProfile=catchAsync(async(req,res)=>{
    const {bio}=req.body;

    const userId=req.user._id

    const user=await updateUserService(userId,bio)
    
    res.status(200).json({
        user
    })

})

export const changePassword=catchAsync(async(req,res)=>{
    const id=req.user._id

    await changePasswordService(req.body,id)

    res.status(200).json({
        message:"Password changed successfully"
    })
})

export const forgotPassword=catchAsync(async(req,res)=>{
    await forgotPasswordService(req.body)

    res.status(200).json({
        message:'if an account exists with this email, a password reset link has been sent.'
    })

})

export const resetPassword=catchAsync(async(req,res)=>{
    const {token}=req.params
    
    await resetPasswordService(token,req.body)

    res.status(200).json({
        message:"Password Reset Successfully.Please log in again"
    })


    
})

export const logout=catchAsync(async(req,res)=>{
    // const id=req.user._id

    // req.sessionId comes from auth.middleware.js
    await logoutServices(req.sessionId)

    const cookieOptions={
        httpOnly:true,
        secure:false, // true in production
        sameSite:'lax',
        path:'/'
    }

    res.status(200)
    .clearCookie('accessToken',cookieOptions)
    .clearCookie('refreshToken',cookieOptions)
    .clearCookie('sessionId',cookieOptions)
    .json({
        message:'Logout Successful'
    })
})


export const getActiveSessions=catchAsync(async(req,res)=>{
    const sessions=await getActiveSessionsService(req.user._id,req.sessionId)

    res.status(200).json({
        sessions
    })
})

// specific session of a user
export const revokeSession=catchAsync(async(req,res)=>{
    const {sessionId}=req.params

    await revokeDeviceSessionService(req.user._id,sessionId)

     res.status(200).json({
        message:'Device session revoked successfully'
     })
})

export const revokeAllSessions=catchAsync(async(req,res)=>{
    await revokeAllSessionsService(req.user._id)

    const cookieOptions={
        httpOnly:true,
        secure:false, // true in production
        sameSite:'lax',
        path:'/'
    }

    res.status(200)
    .clearCookie('accessToken',cookieOptions)
    .clearCookie('refreshToken',cookieOptions)
    .clearCookie('sessionId',cookieOptions)
    .json({
        message:'Logged out from all devices successfully'
    })
})