import jwt from 'jsonwebtoken'
import { catchAsync } from '../../utils/catchAsync.js'
import AppError from '../../utils/appError.js'
import User from './auth.model.js';

export const authenticate = catchAsync(async (req, _, next) => {
    // const authHeader = req.headers.authorization

    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //     return next(new AppError('Invalid Access', 400))
    // }

    // const token = authHeader.split(' ')[1]

    //cookie-parser creates req.cookies.
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
        return next(new AppError('Unauthorized request', 401))
    }

    try {

        const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        // important security critical part 
        // Without ? (decoded._id): If a user provides an invalid, expired, or missing JWT token, the decoded variable will be undefined. If your code tries to read undefined._id, Node.js will throw a fatal error: TypeError: Cannot read properties of undefined (reading '_id'), which can crash your server.
        // With ? (decoded?._id): JavaScript checks if decoded exists first. If decoded is null or undefined, the evaluation stops immediately and safely returns undefined instead of throwing an error.
        const user = await User.findById(decoded?.userId).select('-password -refreshToken')

        if (!user) {
            // discuss about frontend here ToDo
            return next(new AppError('Invalid Access Token', 401))
        }

        req.user = user
        req.sessionId = decoded?.sessionId  // attach sessionId in req

        next()
    } catch (error) {
        if (error) {
            return next(new AppError('access is expired', 401))
        }
        return next(new AppError('Invalid token', 401));
    }
});

export const authorize = (...roles) => {
    return (req, _, next) => {

        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action',403))
        }
        next()
    }
}


// In JavaScript and Node.js, using an underscore(_) as a function parameter is a universal naming convention that means: "This parameter is required by the framework, but I am not using it in my code."
// Why You Can't Just Delete It
// Express relies on the exact position of arguments to know what they are. It always passes arguments in this specific order:
// req (Request)
// res (Response)
// next (Next middleware function)
// If you need to use next but don't need res, you cannot just write async (req, next). If you do, Express will accidentally pass its res object into your next variable, completely breaking your middleware.