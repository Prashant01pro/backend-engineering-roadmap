import path from 'path'
import { v2 as cloudinary } from 'cloudinary'
import streamifier from 'streamifier'
import AppError from '../../utils/appError.js'


// Helper to determine Cloudinary resource_type and format dynamically
const getFileInfo = (key, mimeType = '') => {

    // Extract file extension (e.g., 'pdf', 'docx', 'webp', 'png')
    const ext = path.extname(key).replace('.', '').toLowerCase() || 'bin'

    // Remove extension to get clean public_id for Cloudinary
    const cleanPublicId = key.replace(/\.[^/.]+$/, '')

    // Determine if it is an image or a raw document
    const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
    const resourceType = isImage ? 'image' : 'raw'
    return { ext, cleanPublicId, resourceType, isImage }
}


export class CloudinaryStorageService {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        })
    }

    async init() {
        // cloudinary needs no local folder creation
    }

    // Upload a buffer to Cloudinary as a private raw file or image
    //  url {string} key -eg. "documents/doc-userId-uuid.pdf" or "avatars/avatar-userId-uuid.webp"
    //  buffer - File binary buffer
    //  mimeType - e.g. "application/pdf"

    async save(key, buffer, mimeType = 'application/octet-stream') {
        // const isPdf = mimeType === 'application/pdf'

        // // remove file extention for cloudinary public_id
        // const cleanPublicId = key.replace(/\.[^/.]+$/, '')

        const { ext, cleanPublicId, resourceType, isImage } = getFileInfo(key, mimeType)

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    public_id: cleanPublicId,
                    resource_type: resourceType,
                    // 'authenticated' keeps the file completely private and requires a signed url
                    type: isImage ? 'upload' : 'authenticated',

                    //isImage ? 'upload' : 'authenticated' was written to make:
                    // Avatars (isImage = true) → Publicly viewable ('upload')
                    // Documents (isImage = false) → Strictly private & locked ('authenticated')

                    overwrite: true

                },
                (error, result) => {
                    if (error) {
                        return reject(new AppError(`Cloudinary upload failed: ${error.message}`, 500))
                    }
                    resolve({
                        key: `${result.public_id}.${result.format || ext}`,
                        public_id: result.public_id,
                        location: result.secure_url
                    })
                }
            )
            // pipe memory buffer into cloudinary upload stream
            streamifier.createReadStream(buffer).pipe(uploadStream)
        })
    }

    // delete a file from cloudinary 
    async delete(key) {
        // const cleanPublicId = key.replace(/\.[^/.]+$/, '')
        // const isPdf = key.endsWith('.pdf')

        const { cleanPublicId, resourceType, isImage } = getFileInfo(key)

        try {
            await cloudinary.uploader.destroy(cleanPublicId, {
                resource_type: resourceType,
                type: isImage ? 'upload' : 'authenticated'
            })
        } catch (error) {
            console.error('Cloudinary delete error:', error.message)
        }
    }

    // Generate a short-lived signed URL for private downloads
    // key - Storage key
    // expiresInSeconds - Lifetime (default 15 minutes)

    async generateSignedUrl(key, expiresInSeconds = 900) {
        // const cleanPublicId = key.replace(/\.[^/.]+$/, '')
        // const isPdf = key.endsWith('.pdf')

        const { ext, cleanPublicId, resourceType, isImage } = getFileInfo(key)

        // Generate temporary expiring signed download URL
        const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds

        const signedUrl = cloudinary.utils.private_download_url(cleanPublicId, ext, {
            resource_type: resourceType,
            type: isImage ? 'upload' : 'authenticated',
            expires_at: expiresAt,
            attachment: true // Forces the browser/Windows to download with the exact .ext!
        })

        return signedUrl

    }

    //Stream download fallback (if not redirecting to signed URL)
    async getStream(key) {
        const signedUrl = await this.generateSignedUrl(key, 300)
        const response = await fetch(signedUrl)

        if (!response.ok) {
            throw new AppError('Failed to fetch file from cloud storage', 404)
        }
        return response.body // Web ReadableStream
    }
}

//streamifier converts our Buffer into a readable stream for Cloudinary.