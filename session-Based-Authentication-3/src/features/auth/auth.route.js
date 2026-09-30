import express from 'express'
import { getAllSessions, login, logout, logoutAll, logoutSpecificSession, register } from './auth.controller.js'
import { authenticate } from './auth.middleware.js'

const router=express.Router()

router.post('/register',register)
router.post('/login',login)
router.post('/logout',logout)

router.get('/sessions',authenticate,getAllSessions)
router.post('/logout-all',authenticate,logoutAll)
router.delete('/sessions/:sessionId',authenticate,logoutSpecificSession)

export default router;