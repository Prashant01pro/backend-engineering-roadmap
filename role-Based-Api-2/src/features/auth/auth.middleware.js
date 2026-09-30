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

        if (user.isBanned) {
            return next(new AppError('Your account has been banned', 403))
        }

        req.user = user

        next()
    } catch (error) {
        if (error) {
            return next(new AppError('access is expired', 401))
        }
        return next(new AppError('Invalid token', 401));
    }
});

export const authorize = (...allowedRoles) => {
    return (req, _, next) => {
        if (!req.user) {
            return next(new AppError('Unauthorized request', 401))
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission for this action', 403)
            )
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

// Scenario A: A USER tries to access itThe middleware checks if (!req.user). Let's assume they are logged in, so this check passes.
// It hits the second condition: if (!allowedRoles.includes(req.user.role))
// It evaluates: !['ADMIN'].includes('USER')
// Since 'USER' is not in the array, includes() returns false, and the ! (not) flips it to true.
// The if statement triggers, executing: return next(new AppError('...', 403))
// The Gate Closes: Because it returns early, next() is never called normally, and the request is diverted to your error handler. The getSettings function is completely bypassed.

// Scenario B: An ADMIN tries to access it
// The middleware checks if (!req.user). Pass.
// It hits the second condition: !['ADMIN'].includes('ADMIN')
// Since 'ADMIN' is in the array, includes() returns true, and the ! flips it to false.
// The if block is skipped entirely.
// The code moves to the last line: next()The Gate Opens: next() tells Express to hand the request over to the very next function in the chain, which is getSettings.

// Visual Flow of the InterceptiontextIncoming Request (/settings)
//        │
//        ▼
// ┌──────────────────────────────────────────────┐
// │       authorize('ADMIN') Middleware          │
// ├──────────────────────────────────────────────┤
// │ 1. Is user logged in? (req.user)             │
// │    ├── NO  ──> [401 Unauthorized Error]      │
// │    └── YES ──> Move to next step             │
// │                                              │
// │ 2. Is req.user.role in ['ADMIN']?            │
// │    ├── NO  (e.g., 'USER') ──> [403 Forbidden]│
// │    └── YES (e.g., 'ADMIN') ─┐                │
// └─────────────────────────────────────│────────┘
//                                       │ (next() called)
//                                       ▼
//                        ┌────────────────────────┐
//                        │  getSettings Handler   │
//                        │   (Access Granted!)    │
//                        └────────────────────────┘
// Use code with caution.


// why use ! if includes already says false for not matching roles?

// We use the ! (NOT) operator because the if statement only executes its code block when the condition evaluates to true.
// Since we want to block the user (execute the error code) when their role is not allowed, we have to flip that false into a true.