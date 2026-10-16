import express from 'express'
import { deleteAvatar, getAvatar, me, uploadAvatar } from './user.controller.js'
import { authenticate } from '../auth/auth.middleware.js'
import { uploadAvatarMemory, validateImageMagicBytes } from '../../middlewares/upload.middleware.js'
import { fileUploadRateLimiter } from '../../middlewares/rateLimiter.middleware.js'

const router = express.Router()

router.use(authenticate)

router.get('/me', me)

// Avatar routes
router.route('/me/avatar')
    .get(getAvatar)
    .post(
        fileUploadRateLimiter,
        uploadAvatarMemory,
        validateImageMagicBytes,
        uploadAvatar
    )
    .delete(deleteAvatar)

export default router