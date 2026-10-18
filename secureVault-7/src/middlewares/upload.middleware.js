import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import AppError from '../utils/appError.js'

// keep file in memory buffer for sharp processing
const storage = multer.memoryStorage()

// multer instance with strict size limit(2 MB)
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }) // 2 mb

export const uploadAvatarMemory = upload.single('avatar')

// magic-byte validation middleware (defence-in-depth)
export const validateImageMagicBytes = async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please provide an image file to upload', 400))
    }

    //inspect the actual binary header bytes of the buffer 
    const detectedType = await fileTypeFromBuffer(req.file.buffer)

    const allowedMIMETypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!detectedType || !allowedMIMETypes.includes(detectedType.mime)) {
        return next(new AppError('Invalid file format . Only genuine jpeg, png, and webP images are allowed.', 400))
    }

    // attach detected type to req.file (never trust req.file.mimetype sent by client)
    req.file.verifiedMime = detectedType.mime
    req.file.verifiedExt = detectedType.ext

    next()
}

// PDF Document Multer instance (10MB max)
const uploadDocument = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
})
export const uploadDocumentMemory = uploadDocument.single('document')

// Validate PDF Magic Byte
export const validatePdfMagicBytes = async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please provide a PDF document to upload', 400))
    }

    const allowedDocumentMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip'
    ]

    const detectedType = await fileTypeFromBuffer(req.file.buffer)
    
    if (!detectedType || !allowedDocumentMimes.includes(detectedType.mime)) {
        return next(new AppError('Invalid file format. Disallowed file type.', 400))
    }

    req.file.verifiedMime = detectedType.mime
    next()
}