import AppError from "../../utils/appError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { changePasswordService, forgotPasswordService, getActiveSessionsService, loginServices, logoutServices, refreshServices, registerService, resendVerificationService, resetPasswordService, revokeAllSessionsService, revokeDeviceSessionService, updateAvatarService, updateUserService, verifyEmailService } from "./auth.services.js";

import { getCache, setCache, invalidateCache, CACHE_TTL } from '../../utils/cache.js';
import User from './auth.model.js';

const baseCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
}

export const register = catchAsync(async (req, res) => {

    const { user, accessToken, refreshToken, sessionId } = await registerService(req.body, req)

    const cookieOptions = {
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
    res.cookie('sessionId', sessionId, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
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

    const { user, accessToken, refreshToken, sessionId } = await loginServices(req.body, req)

    const cookieOptions = {
        httpOnly: true,
        secure: false, // true in production
        sameSite: 'lax'
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

    res.cookie('sessionId', sessionId, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(200).json({
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

export const refresh = catchAsync(async (req, res, next) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refresh
    const incomingSessionId = req.cookies?.sessionId || req.body?.sessionId

    if (!incomingRefreshToken || !incomingSessionId) {
        return next(new AppError('Invalid session. Please login again.', 401))
    }

    const { newAccessToken, newRefreshToken, sessionId } = await refreshServices(incomingRefreshToken, incomingSessionId);

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }

    res.cookie('accessToken', newAccessToken, {
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
        message: 'new Access token generated'
    })


})

export const myprofile = catchAsync(async (req, res) => {
    // const user=await User.findById(req.user._id)

    const userId = req.user._id.toString();
    const cacheKey = `cache:user:profile:${userId}`

    // check redis cache
    const cachedProfile = await getCache(cacheKey);
    if (cachedProfile) {
        res.setHeader('X-Cache', 'HIT'); // inform client the response came from redis
        return res.status(200).json({
            status: 'success',
            source: 'cache',
            user: cachedProfile,
        })
    }

    // On Cache MISS: Query MongoDB
    const user = await User.findById(userId).select('-password');

    //Populate Redis with 2-minute TTL
    await setCache(cacheKey, user, CACHE_TTL.USER_PROFILE);

    res.setHeader('X-Cache', 'MISS')
    res.status(200).json({
        status: 'success',
        source: 'database',
        user: user
    })
})

export const updateProfile = catchAsync(async (req, res) => {
    const { bio } = req.body;
    const userId = req.user._id

    const user = await updateUserService(userId, bio)

    //Explicit Cache Invalidation: Delete stale cached profile
    await invalidateCache(`cache:user:profile:${userId}`);

    res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        user
    })

})

export const changePassword = catchAsync(async (req, res) => {
    const id = req.user._id

    await changePasswordService(req.body, id)

    res.status(200)
        .clearCookie('accessToken', baseCookieOptions)
        .clearCookie('refreshToken', baseCookieOptions)
        .clearCookie('sessionId', baseCookieOptions)
        .json({
            message: "Password changed successfully.Please login again"
        })
})

export const forgotPassword = catchAsync(async (req, res) => {
    await forgotPasswordService(req.body)

    res.status(200).json({
        message: 'if an account exists with this email, a password reset link has been sent.'
    })

})

export const resetPassword = catchAsync(async (req, res) => {
    const { token } = req.params

    await resetPasswordService(token, req.body)

    res.status(200).json({
        message: "Password Reset Successfully.Please log in again"
    })



})

export const logout = catchAsync(async (req, res) => {
    // const id=req.user._id

    // req.sessionId comes from auth.middleware.js
    await logoutServices(req.sessionId)

    const cookieOptions = {
        httpOnly: true,
        secure: false, // true in production
        sameSite: 'lax',
        path: '/'
    }

    res.status(200)
        .clearCookie('accessToken', cookieOptions)
        .clearCookie('refreshToken', cookieOptions)
        .clearCookie('sessionId', cookieOptions)
        .json({
            message: 'Logout Successful'
        })
})


export const getActiveSessions = catchAsync(async (req, res) => {
    const sessions = await getActiveSessionsService(req.user._id, req.sessionId)

    res.status(200).json({
        sessions
    })
})

// specific session of a user
export const revokeSession = catchAsync(async (req, res) => {
    const { sessionId } = req.params

    await revokeDeviceSessionService(req.user._id, sessionId)

    res.status(200).json({
        message: 'Device session revoked successfully'
    })
})

export const revokeAllSessions = catchAsync(async (req, res) => {
    await revokeAllSessionsService(req.user._id)

    const cookieOptions = {
        httpOnly: true,
        secure: false, // true in production
        sameSite: 'lax',
        path: '/'
    }

    res.status(200)
        .clearCookie('accessToken', cookieOptions)
        .clearCookie('refreshToken', cookieOptions)
        .clearCookie('sessionId', cookieOptions)
        .json({
            message: 'Logged out from all devices successfully'
        })
})

export const updateAvatar = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please select an image to upload', 400));
    }

    const userId = req.user._id.toString();
    const result = await updateAvatarService(userId, req.file.buffer);

    //Explicit Cache Invalidation: Delete stale cached avatar
    await invalidateCache(`cache:user:profile:${userId}`);

    res.status(200).json({
        status: 'success',
        message: 'Profile picture updated successfully',
        data: result,
    });
});

export const verifyEmail = catchAsync(async (req, res) => {
    const { token } = req.params;
    const result = await verifyEmailService(token);

    res.status(200).json({
        status: 'success',
        message: 'Email verified successfully! You can now use all platform features.',
        data: result,
    });
});

export const resendVerification = catchAsync(async (req, res) => {
    const { email } = req.body;
    await resendVerificationService(email);

    res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, a verification link has been sent.',
    });
});