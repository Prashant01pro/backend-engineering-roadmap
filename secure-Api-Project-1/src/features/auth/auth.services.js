import AppError from '../../utils/appError.js'
import { generateAccessToken, generateRefreshToken } from '../../utils/token.js'
import User from './auth.model.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { sendEmail } from '../../utils/sendEmail.js'

export const registerService = async (body) => {
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

    // genetate token
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12)

    user.refreshToken = hashedRefreshToken
    await user.save({ validateBeforeSave: false })

    return { user, accessToken, refreshToken }

}

export const loginServices = async (body) => {
    const { email, password } = body

    if (!email || !password) {
        throw new AppError('Email and Password required', 409)
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new AppError("User didn't exist", 409)
    }

    const matchPassword = await bcrypt.compare(password, user.password)
    if (!matchPassword) {
        throw new AppError('Email and Password required', 409)
    }

    // genetate token
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12)

    user.refreshToken = hashedRefreshToken
    await user.save({ validateBeforeSave: false })

    return { user, accessToken, refreshToken }
    //The database receives only its hash; the browser receives the original token. That is correct.


}

export const refreshServices = async (token) => {
    const incomingRefreshToken = token

    try {

        const decodedToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?.userId)
        if (!user) {
            throw new AppError('Invalid Token/user', 409)
        }

        // if (refreshToken !== user?.refreshToken) {
        //     throw new AppError('')
        // }

        const isValid = await bcrypt.compare(incomingRefreshToken, user.refreshToken)

        if (!isValid) {
            throw new AppError('Invalid refresh token', 401)
        }

        const newAccessToken = generateAccessToken(user)
        const newRefreshToken = generateRefreshToken(user)

        const newHashedRefreshToken = await bcrypt.hash(newRefreshToken, 12)

        user.refreshToken = newHashedRefreshToken
        await user.save({ validateBeforeSave: false })
        // If you set validateBeforeSave: true (or leave it out, since true is the default), Mongoose will validate the entire user document against your schema rules before updating the refresh token.

        return { newAccessToken, newRefreshToken }
    } catch (error) {
        // if (error) {
        //     throw new AppError('internal error login again', 401)
        // }

        // If it's already an operational AppError, throw it as-is
        if (error instanceof AppError) throw error;

        throw new AppError('Invalid token login again', 401);
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
        user.refreshToken = null;
    
        await user.save({validateBeforeSave:false})
    } catch (error) {
        if (error instanceof AppError) throw error

        throw new AppError('Something went wrong, Please try again later')
        
    }
}

export const logoutServices = async (id) => {
    await User.findByIdAndUpdate(id,
        {
            // mongodb query to set 
            $set: { refreshToken: null }

            //Why: undefined means “no JavaScript value.”
            // Set it explicitly to null:
            // This keeps the field but clearly means: “the user has no active refresh token.”
        },
        {
            // because of this ,new values returned , if not this , old refresh token can be returned
            returnDocument:'after'
        }
    )
}







// Because registerService does not have Express’s next function.
// Inside a controller, you can do:
// return next(new AppError('User already exists', 409))
// But your service only receives body:
// export const registerService = async (body) => {
// So next is undefined there.
// throw stops the service immediately and sends the error back to the controller’s catchAsync, which forwards it to your global error middleware: