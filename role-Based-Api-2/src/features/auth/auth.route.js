import express from 'express'
import { adminLogin, changePassword, forgotPassword, login, logout, myprofile, refresh, register, resetPassword, updateProfile } from './auth.controller.js'
import { authenticate } from './auth.middleware.js'

const router=express.Router()

router.post('/register',register)
router.post('/login',login)
router.post('/refresh',refresh)
router.post('/logout',authenticate,logout)

router.post('/forgot-password',forgotPassword)
router.post('/reset-password/:token',resetPassword)

router.patch('/change-password',authenticate,changePassword)
router.patch('/update-profile',authenticate,updateProfile)
router.get('/profile',authenticate,myprofile)

router.post('/admin/login',adminLogin)
export default router



// Using router.route() keeps your code clean and organized. If you later want to create a GET request for the same /login page, you can easily chain it like this:javascriptrouter.route('/login')
//   .get(showLoginPage)   // Serves the login HTML page
//   .post(login);         // Processes the submitted form data
