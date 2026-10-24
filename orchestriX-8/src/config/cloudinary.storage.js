import { v2 as cloudinary } from 'cloudinary'
import { env } from './env.js';
import { logger } from './logger.js';
import streamifier from 'streamifier'
import AppError from '../utils/appError.js'

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
})

export const uploadToCloudinary = (buffer, folder = 'orchestrix/avatars') => {
    return new Promise((resolve, reject) => {

        // Uploads an in-memory buffer directly to Cloudinary
        // @param {Buffer} buffer - File buffer from Multer
        // @param {string} folder - Destination folder on Cloudinary
        // @returns {Promise<{ url: string, publicId: string }>}

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                transformation: [
                    { width: 300, height: 300, crop: 'fill', gravity: 'face' }, // auto crop to square focusing on face
                    { quality: 'auto', fetch_format: 'auto' }
                ],
            },
            (error, result) => {
                if (error) {
                    logger.error({ err: error }, "Cloudinary upload stream failed");
                    return reject(new AppError('Failed to upload image to cloud storage', 500))
                }
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                })
            }
        );

        // pipe buffer stream into cloudinary
        streamifier.createReadStream(buffer).pipe(uploadStream);
    })
}

// Deletes an image from Cloudinary by public ID
// @param {string} publicId

export const deleteFromCloudinary=async(publicId)=>{
    if(!publicId) return;
    try{
        await cloudinary.uploader.destroy(publicId);
    }catch(error){
        logger.error({err:error,publicId},'Failed to delete old image from Cloudinary')
    }
}