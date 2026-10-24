import multer from 'multer'
import AppError from '../utils/appError.js'

//  Hold files in RAM buffer (not disk) so we can stream to Cloudinary:keep file in memory buffer for sharp processing
const storage = multer.memoryStorage()

// multer instance with strict size limit(2 MB)
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },// 2 mb
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new AppError('Only image files (JPEG, PNG, WEBP) are allowed!', 400), false);
        }
    },
})


export const uploadAvatarMiddleware = upload.single('avatar')

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