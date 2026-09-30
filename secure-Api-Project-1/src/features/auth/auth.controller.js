import AppError from "../../utils/appError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { changePasswordService, forgotPasswordService, loginServices, logoutServices, refreshServices, registerService, resetPasswordService, updateUserService } from "./auth.services.js";

export const register = catchAsync(async (req, res) => {

    const { user, accessToken, refreshToken } = await registerService(req.body)

    // send accesstoken as httpOnly cookie
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    });


    // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
        message: 'Registration Successful',
        accessToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

export const login = catchAsync(async (req, res) => {

    const { user, accessToken, refreshToken } = await loginServices(req.body)


    // send accesstoken as httpOnly cookie
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
        maxAge: 15* 60 * 1000
    });


    // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
        message: 'login Successful',
        accessToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

export const refresh=catchAsync(async(req,res,next)=>{
    const incomingRefreshToken=req.cookies?.refreshToken || req.body?.refresh

    if(!incomingRefreshToken){
        return next(new AppError('Invalid user session. Please login again.', 401))
    }

    const { newAccessToken,newRefreshToken}=await refreshServices(incomingRefreshToken);

    res.cookie('accessToken',newAccessToken,{
         httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    })

     // send refreshtoken as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: false,  // true in production
        sameSite: 'lax',
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
    const id=req.user._id

    await logoutServices(id)

    const cookieOptions={
        httpOnly:true,
        secure:false,
        sameSite:'lax',
        path:'/'
    }

    res.status(200)
    .clearCookie('accessToken',cookieOptions)
    .clearCookie('refreshToken',cookieOptions)
    .json({
        message:'Logout Successful'
    })
})