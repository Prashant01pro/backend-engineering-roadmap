import { LocalStorageService } from './local.storage.js'
import { CloudinaryStorageService } from './cloudinary.storage.js'

const driver = process.env.STORAGE_DRIVER || 'local'

let storageInstance

if (driver === 'cloudinary') {
    storageInstance = new CloudinaryStorageService()
    console.log('File Storage Driver: Cloudinary cloud storage')
} else {
    storageInstance = new LocalStorageService(process.env.LOCAL_STORAGE_PATH || 'uploads')

    await storageInstance.init()
    console.log('File storage: Local Disk Storage')
}

export const storage = storageInstance