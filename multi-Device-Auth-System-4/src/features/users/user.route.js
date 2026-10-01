import express from 'express'
import { me } from './user.controller.js'
import { authenticate } from '../auth/auth.middleware.js'

const router =express.Router()

router.get('/me',authenticate,me)

export default router