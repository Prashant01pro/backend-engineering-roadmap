import express from 'express'
import { authenticate,authorize } from '../auth/auth.middleware.js'
import { adminLogin, banUserByAdmin, changeUserRole, createUserByAdmin, deleteUserByAdmin, getAllUsers, unbanUserByAdmin } from './admin.controller.js'

const router=express.Router()

// Public route, but credentials must belong to an ADMIN.
router.post('/login',adminLogin)

// Every route below must have an ADMIN access token.
router.use(authenticate,authorize('ADMIN'));

router.route('/users')
.get(getAllUsers)
.post(createUserByAdmin)

router.delete('/users/:id', deleteUserByAdmin)
router.patch('/users/:id/ban', banUserByAdmin)
router.patch('/users/:id/unban', unbanUserByAdmin)
router.patch('/users/:id/role', changeUserRole)

export default router