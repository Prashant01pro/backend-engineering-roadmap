import AppError from "../../utils/appError.js"
import User from "../auth/auth.model.js"
import bcrypt from 'bcrypt'

const safeFields = '-password -refreshToken -resetPasswordToken -resetPasswordExpires'

export const getAllUsersService = async () => {
    return User.find()
        .select(safeFields)
        .sort({ createdAt: -1 })
}

export const createUserByAdminService = async (body) => {
    const { name, email, password, bio } = body

    if (!name || !email || !password) {
        throw new AppError('Name, email, and password are required', 400)
    }

    if (password.length < 10) {
        throw new AppError('Password must be more than 10 characters')
    }

    const existingUser = await User.findOne({ email })

    if (existingUser) {
        throw new AppError('User already exists', 409)
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    return User.create({
        name,
        email,
        password: hashedPassword,
        bio,
        role: "USER"
    })
}

export const deleteUserByAdminService = async (userId, adminId) => {
    if (userId === adminId.toString()) {
        throw new AppError('You cannot delete your own account', 400)
    }

    const user = await User.findByIdAndDelete(userId)

    if (!user) {
        throw new AppError('User not found', 404)
    }

}

export const banUserByAdminService = async (userId, adminId, isBanned) => {
    if (userId === adminId) {
        throw new AppError('You cannot ban your own account', 400)
    }

    const user = await User.findByIdAndUpdate(userId,
        {
            isBanned,
            refreshToken: null
        },
        {
            returnDocument: 'after',
            runValidators: true
        }

    ).select(safeFields)

    if (!user) {
        throw new AppError('User not found', 404)
    }

    return user
}

export const changeUserRoleService=async(userId,adminId,role)=>{
    const validRoles=['USER','ADMIN','MODERATOR']

    if(!validRoles.includes(role)){
        throw new AppError('Role must be USER, ADMIN OR MODERATOR',400)
    }

    if (userId === adminId.toString()) {
        throw new AppError('You cannot change your own role', 400)
    }

    const user=await User.findByIdAndUpdate(userId,{role},
        {
            returnDocument:'after',
            runValidators:true
        }
    ).select(safeFields)

    if(!user) {
        throw new AppError('User not found', 404)
    }
    return user

}