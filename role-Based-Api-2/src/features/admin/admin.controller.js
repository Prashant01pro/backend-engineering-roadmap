import { catchAsync } from '../../utils/catchAsync.js'
import { loginServices } from '../auth/auth.services.js'
import {banUserByAdminService, changeUserRoleService, createUserByAdminService, deleteUserByAdminService, getAllUsersService} from './admin.services.js'

export const adminLogin = catchAsync(async (req, res) => {
    const { user, accessToken, refreshToken } = await loginServices(
        req.body,
        'ADMIN'
    )

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false, // true in production
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    })

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(200).json({
        message: 'Admin login successful',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    })
})

export const getAllUsers = catchAsync(async (_, res) => {
    const users = await getAllUsersService()

    res.status(200).json({
        count: users.length,
        users
    })
})

export const createUserByAdmin = catchAsync(async (req, res) => {
    const user = await createUserByAdminService(req.body)

    res.status(201).json({
        message: 'User created successfully',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    })
})

export const deleteUserByAdmin = catchAsync(async (req, res) => {
    await deleteUserByAdminService(req.params.id, req.user._id)

    res.status(204).send({
        message: 'User deleted successfully',
    })
})

export const banUserByAdmin = catchAsync(async (req, res) => {
    const user = await banUserByAdminService(
        req.params.id,
        req.user._id,
        true
    )

    res.status(200).json({
        message: 'User banned successfully',
        user
    })
})

export const unbanUserByAdmin = catchAsync(async (req, res) => {
    const user = await banUserByAdminService(
        req.params.id,
        req.user._id,
        false
    )

    res.status(200).json({
        message: 'User unbanned successfully',
        user
    })
})

export const changeUserRole = catchAsync(async (req, res) => {
    const user = await changeUserRoleService(
        req.params.id,
        req.user._id,
        req.body.role
    )

    res.status(200).json({
        message: 'User role updated successfully',
        user
    })
})