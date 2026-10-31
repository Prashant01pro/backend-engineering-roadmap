import express from 'express';
import { changePassword, forgotPassword, getActiveSessions, login, logout, myprofile, refresh, register, resendVerification, resetPassword, revokeAllSessions, revokeSession, updateAvatar, updateProfile, verifyEmail } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema, validate } from './auth.validation.js';
import { loginRateLimiter, passwordResetRateLimiter, registerRateLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { uploadAvatarMiddleware, validateImageMagicBytes } from '../../middlewares/upload.middleware.js';

const router = express.Router();

router.post('/register', registerRateLimiter, validate(registerSchema), register);
router.post('/login', loginRateLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

router.post('/forgot-password', passwordResetRateLimiter, forgotPassword);
router.post('/reset-password/:token', passwordResetRateLimiter, validate(resetPasswordSchema), resetPassword);

router.get('/profile', authenticate, myprofile);
router.patch('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.patch('/update-profile', authenticate, updateProfile);

// multi-device management routes
router.get('/sessions', authenticate, getActiveSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSession);
router.delete('/sessions', authenticate, revokeAllSessions);

router.patch('/avatar', authenticate, uploadAvatarMiddleware, validateImageMagicBytes, updateAvatar);

// Verification endpoints
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

export default router;
