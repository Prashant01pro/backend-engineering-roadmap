import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import AppError from '../../utils/appError.js'

export class LocalStorageService {
    constructor(baseDir = 'uploads') {
        this.baseDir = path.resolve(baseDir)
    }

    async init() {
        await fs.mkdir(this.baseDir, { recursive: true })
        await fs.mkdir(path.join(this.baseDir, 'avatars'), { recursive: true })
        await fs.mkdir(path.join(this.baseDir, 'documents'), { recursive: true })
    }

    getFilePath(key) {
        return path.join(this.baseDir, key)
    }

    async save(key, buffer) {
        const filePath = this.getFilePath(key)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, buffer)
        return { key, location: filePath }
    }

    async getStream(key) {
        const filePath = this.getFilePath(key)
        try {
            await fs.access(filePath)
            return fsSync.createReadStream(filePath)
        } catch {
            throw new AppError('File not found in local storage', 404)
        }
    }

    async delete(key) {
        const filePath = this.getFilePath(key)
        await fs.unlink(filePath).catch(() => { })
    }

    // In local development, signed URLs fallback to standard local routes
    async generateSignedUrl(key) {
        return null // Indicates the server must proxy the stream itself
    }
}