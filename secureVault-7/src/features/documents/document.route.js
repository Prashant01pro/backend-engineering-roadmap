import express from 'express'
import { uploadDocument, listDocuments, getDocumentMetadata, downloadDocument, deleteDocument } from './document.controller.js'
import { authenticate } from '../auth/auth.middleware.js'
import { uploadDocumentMemory, validatePdfMagicBytes } from '../../middlewares/upload.middleware.js'
import { fileUploadRateLimiter, fileDownloadRateLimiter } from '../../middlewares/rateLimiter.middleware.js'

const router = express.Router()

// All document operations require an authenticated session
router.use(authenticate)

router.route('/')
    .get(listDocuments)
    .post(
        fileUploadRateLimiter,
        uploadDocumentMemory,
        validatePdfMagicBytes,
        uploadDocument
    )

router.route('/:documentId')
    .get(getDocumentMetadata)
    .delete(deleteDocument)

router.get('/:documentId/download', fileDownloadRateLimiter, downloadDocument)

export default router