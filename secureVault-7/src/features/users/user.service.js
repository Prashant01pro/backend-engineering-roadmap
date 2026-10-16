import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import AppError from "../../utils/appError.js"
import User from "../auth/auth.model.js"

const AVATAR_DIR = path.resolve('uploads/avatars')

// ensure directory exists on startup
await fs.mkdir(AVATAR_DIR, { recursive: true })

export const getMeService = async (id) => {

    const user = await User.findById(id).select('-password')

    if (!user) {
        throw new AppError('Invalid user or Expires session ', 401)
    }

    return user;

}

export const uploadAvatarService = async (userId, fileBuffer) => {
    const user = await User.findById(userId)
    if (!user) throw new AppError('User not found', 404)

    // generate an unpredictable storage filename
    const newFilename = `avatar-${userId}-${crypto.randomUUID()}.webp`
    const newFilePath = path.join(AVATAR_DIR, newFilename)

    // process image with Sharp (resize 250 X 250, strip EXIF metadata, convert to webp)
    const processedBuffer = await sharp(fileBuffer)
        .resize(250, 250, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer()

    // write processed image to disk
    await fs.writeFile(newFilePath, processedBuffer)

    // store old key for safe cleanup later
    const oldAvatarKey = user.avatar?.key

    try {
        // update mongodb user record
        user.avatar = {
            key: newFilename,
            mimeType: 'image/webp',
            size: processedBuffer.length,
            updatedAt: new Date()
        }
        await user.save({ validateBeforeSave: false })

        // safe replacement :remove previous avatar file from disk after successful db update
        if (oldAvatarKey) {
            const oldFilePath = path.join(AVATAR_DIR, oldAvatarKey)
            await fs.unlink(oldFilePath).catch(() => { })
        }
        return user.avatar
    } catch (error) {
        // orphan cleanup:if db save failed , delete the newly written file
        await fs.unlink(newFilePath).catch(() => { })
        throw error
    }
}

export const getAvatarPathService = async (userId) => {
    const user = await User.findById(userId)
    if (!user || !user.avatar?.key) {
        throw new AppError('No avatar found for this user', 404)
    }

    const filePath = path.join(AVATAR_DIR, user.avatar.key)

    try {
        await fs.access(filePath)
    } catch {
        throw new AppError('Avatar file missing on storage', 404)
    }
    return { filePath, mimeType: user.avatar.mimeType }
}

export const deleteAvatarService = async (userId) => {
    const user = await User.findById(userId)

    if (!user || !user.avatar?.key) {
        throw new AppError('No avatar to delete', 404)
    }

    const filePath = path.join(AVATAR_DIR, user.avatar.key)

    // Clear avatar in DB first
    user.avatar = { key: null, mimeType: null, size: null, updatedAt: null }
    await user.save({ validateBeforeSave: false })

    // Delete physical file
    await fs.unlink(filePath).catch(() => { })
}