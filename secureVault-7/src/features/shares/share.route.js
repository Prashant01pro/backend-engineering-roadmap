import express from 'express'
import { createShareLink, accessSharedDocument, listDocumentShares, revokeShareLink } from './share.controller.js'
import { authenticate } from '../auth/auth.middleware.js'
import { fileDownloadRateLimiter } from '../../middlewares/rateLimiter.middleware.js'

const router = express.Router()

// Public route
router.get('/:shareToken', fileDownloadRateLimiter, accessSharedDocument)

// Protected routes
router.post('/documents/:documentId', authenticate, createShareLink)
router.get('/documents/:documentId', authenticate, listDocumentShares)
router.delete('/:shareId', authenticate, revokeShareLink)

export default router