import crypto from 'crypto'
import AppError from '../../utils/appError.js'
import { generateAccessToken, generateRefreshToken, hashToken } from '../../utils/token.js'
import User from './auth.model.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sendEmail } from '../../utils/sendEmail.js'
import { parseDeviceInfo } from '../../utils/deviceInfo.js'
import { createSession, deleteAllUserSessions, deleteSession, getSession, getUserSessions, updateSessionToken } from '../../stores/redis.sessions.store.js'

export const registerService = async (body,req) => {
    const { name, email, password, bio } = body

    if (!name || !email || !password) {
        throw new AppError('Fill the required Fields', 400)
    }

    if(password.length <10){
        throw new AppError('Password must be greater than 10 characters')
    }

    // find user either on basis of name or email : $or is mongobd operator
    const existingUser = await User.findOne({
        $or: [{ name }, { email }]
    })
    if (existingUser) {
        throw new AppError('User already Exist', 409)
    }

    const hashPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
        name,
        email,
        password: hashPassword,
        bio
    })

    // create initial device session in Redis
    const sessionId=crypto.randomUUID()
    const rawRefreshToken=generateRefreshToken()
    const hashedRefreshToken=hashToken(rawRefreshToken)
    const deviceInfo=parseDeviceInfo(req)

    const sessionData={
        sessionId,
        userId:user._id.toString(),
        refreshTokenHash:hashedRefreshToken,
        deviceInfo,
        createdAt:new Date().toISOString(),
        lastActive:new Date().toISOString()
    }

    await createSession(sessionId,sessionData)
    const accessToken=generateAccessToken(user,sessionId)

    return { user, accessToken, refreshToken:rawRefreshToken,sessionId }

}

export const loginServices = async (body,req) => {
    const { email, password } = body

    if (!email || !password) {
        throw new AppError('Email and Password required', 400)
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new AppError("User didn't exist", 401)
    }

    const matchPassword = await bcrypt.compare(password, user.password)
    if (!matchPassword) {
        throw new AppError('Invalid credentials', 401)
    }

    // generate a unique session ID for this specific device
    const sessionId=crypto.randomUUID()

    // genetate raw refresh token
    const rawRefreshToken = generateRefreshToken()
    // const hashedRefreshToken = await bcrypt.hash(refreshToken, 12)
    const hashedRefreshToken=hashToken(rawRefreshToken)

    //Extract device metadata from incoming HTTP request
    const deviceInfo=parseDeviceInfo(req)

    // construct device session Payload
    const sessionData={
        sessionId,
        userId:user._id.toString(),
        refreshTokenHash:hashedRefreshToken,
        deviceInfo,
        createdAt:new Date().toISOString(),
        lastActive:new Date().toISOString()
    }

    // save the session directly in Redis
    await createSession(sessionId,sessionData)

    // access token containing the sessionId
    const accessToken = generateAccessToken(user,sessionId)

    //Return tokens to controller (rawRefreshToken will be set in HttpOnly cookie)
    return { 
        user, 
        accessToken,
        refreshToken:rawRefreshToken,
        sessionId
    }
   
    

}

export const refreshServices = async (incomingRefreshToken, sessionId) => {
    if(!incomingRefreshToken || !sessionId){
        throw new AppError('Invalid session. Please login again',401)
    }

    // fetch device session from Redis
    const session=await getSession(sessionId)
    if (!session) {
        throw new AppError('Session expired or revoked. Please login again.', 401)
    }

    // hash incoming token
    const incomingHash=hashToken(incomingRefreshToken)

    // compare with stored hash refresh token
    if(incomingHash !== session.refreshTokenHash){
        await deleteSession(sessionId)
        throw new AppError('Security violation: Token reuse detected . Session terminated',403)
    }

    // now fetch user from db to ensure user exist
    const user=await User.findById(session.userId)
    if (!user) {
        await deleteSession(sessionId)
        throw new AppError('User no longer exists', 401)
    }

    // rotate: generate new refresh token and new accesstoken
    const newRefreshToken=generateRefreshToken()
    const newHashedRefreshToken=hashToken(newRefreshToken)

    // update session in Redis 
    await updateSessionToken(sessionId,newHashedRefreshToken)

    const newAccessToken=generateAccessToken(user,sessionId)

    return {
        newAccessToken,
        newRefreshToken,
        sessionId
    }
    

}

export const updateUserService = async (userId, newBio) => {

    const updates = {}

    if (newBio !== undefined) {
        updates.bio = newBio
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
        returnDocument: 'after',
        runValidators: true,
    }).select('-name -email -password -refreshToken')

    return user
}

export const changePasswordService = async (body, id) => {
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
        throw new AppError('Fill the fields', 409)
    }

    if (newPassword.length < 10) {
        throw new AppError("Password must be more than 8 characters", 400)
    }

    const user = await User.findById(id).select('+password');

    try {


        const valid = await bcrypt.compare(currentPassword, user.password)

        if (!valid) {
            throw new AppError('Invalid password', 400)
        }

        // Prevent setting the same password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            throw new AppError('New password cannot be the same as the old password', 400);
        }

        user.password = await bcrypt.hash(newPassword, 12)
        await user.save({ validateBeforeSave: false })

    } catch (error) {
        if (error instanceof AppError) throw error

        throw new AppError("Password can't be changed", 401)

    }
}

export const forgotPasswordService = async (body) => {
    const { email } = body

    if(!email){
        throw new AppError('Email is required',400)
    }

    const user=await User.findOne({email});

    if(!user){
        throw new AppError('if an account exists with this email, a password reset link has been sent.',400)
    }

    try {
        // Generate Random token
        const resetToken=crypto.randomBytes(32).toString('hex');
    
        // Hash resetToken before storing in database
        const hashedToken=crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
        // Assign values to the user object (No 'await' on assignments)
        user.resetPasswordToken = hashedToken
        user.resetPasswordExpires= Date.now() + 15 *60 *1000;
    
        await user.save({validateBeforeSave:false})
    
        // Create frontend reset URL
        const resetURL=`${process.env.FRONTEND_URL}/reset-password/${resetToken}`
    
        const html=`<div style='font-family:Arial, sans-serif;'>
                    <h2>Password Reset Request </h2>
                    <p> Hello ${user.name},</P>
                    <p>We received a request to reset your password.</p>
                    <p>Click the button below to reset your password </p>
                    <a href="${resetURL}" style="display:inline-block;
                                                 padding:12px 20px;
                                                 background:#2563eb;
                                                 color:white;
                                                 text-decoration:none;
                                                 border-radius:6px;">
                    Reset Password </a>
                    <p>This link will expire in 15 minutes </p>
                    <p>If you did not request a password reset , you can safely ignore this email </p>
                    </div> `;
        await sendEmail({
            to:user.email,
            subject:"Password Reset Request",
            html,
        })
    } catch (error) {

        console.error('Forgot-password email error:', error);
        if(error instanceof AppError) throw error

        throw new AppError('Something went wrong, Please Try again later')
    }

}

export const resetPasswordService=async(token,body)=>{
    const {newPassword}=body
    
    if(!token || !newPassword){
        throw new AppError('Reset Token or New Password is required',400)
    };

    if(newPassword.length <10){
        throw new AppError('Password must be greater than 10 characters')
    }

    try {
        // Hash token received from frontend
        const hashedToken=crypto.
        createHash('sha256')
        .update(token)
        .digest('hex');
    
        // find user with valid token
    
        const user=await User.findOne({resetPasswordToken:hashedToken,resetPasswordExpires:{$gt:Date.now()}})
        .select('+resetPasswordToken +resetPasswordExpires')
    
        if(!user){
            throw new AppError('Invalid or expires reset token')
        }
    
        //hash new password 
        const hashedPassword =await bcrypt.hash(newPassword,12);
        user.password=hashedPassword;
    
        // Invalidate reset Token
        user.resetPasswordToken=undefined;
        user.resetPasswordExpires=undefined;
    
        await user.save({validateBeforeSave:false})

        // Invalidate all redis sessions
        // After saving new password
        await deleteAllUserSessions(user._id.toString())
        
    } catch (error) {
        if (error instanceof AppError) throw error

        throw new AppError('Something went wrong, Please try again later')
        
    }
}

export const logoutServices = async (sessionId) => {

   // Replaces the MongoDB query with Redis session deletion
    if(sessionId){
        await deleteSession(sessionId)
    }

}

// list all active devices for the user and flags which one is current.
export const getActiveSessionsService=async(userId, currentSessionId)=>{
   const sessions=await getUserSessions(userId)

   return sessions.map((s)=>({
    sessionId:s.sessionId,
    deviceInfo:s.deviceInfo,
    createdAt:s.createdAt,
    lastActive:s.lastActive,
    isCurrentDevice:s.sessionId === currentSessionId
   }))

}

// revokes a specific remote device session
export const revokeDeviceSessionService=async(userId, targetSessionId)=>{
    const session=await getSession(targetSessionId)

    if(!session || session.userId !== userId.toString()){
        throw new AppError('Session not found or unauthorized',404)
    }

    await deleteSession(targetSessionId)
}

// logout from everywhere: revokes all device sessions
export const revokeAllSessionsService=async(userId)=>{
    await deleteAllUserSessions(userId)
}

