import AppError from "../../utils/appError.js";
import jwt from 'jsonwebtoken'
import { catchAsync } from "../../utils/catchAsync.js";
import { findUserById } from "./auth.repository.js";
import { env } from "../../config/env.js";

export const authenticateUser = catchAsync(async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError("You are not logged in. Please log in to get access.", 401));
    }

    const token = authHeader.split(' ')[1]

    const decoded = await jwt.verify(token, env.jwt.secret)

    if (!decoded) {
        throw new AppError('invalid credientials', 401)
    }

    const user = await findUserById(decoded.id)

    if (!user) {
        throw new AppError('invalid user or User not found', 401)
    }

    req.user = user;
    next()

})

export const restrictTo=(...roles)=>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
            return next(new AppError('You do not have permission to perform this action', 403))
        }
        next();
    }
}