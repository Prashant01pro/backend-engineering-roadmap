import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import Document from './document.model.js'
import AppError from '../../utils/appError.js'

const DOCUMENT_DIR = path.resolve('uploads/documents')
await fs.mkdir(DOCUMENT_DIR, { recursive: true })

export const uploadDocumentService = async (userId, file) => {
    // sanitize original filename(remove directory traversal characters like ../)
    const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')

    // unpredictable storage key
    const storageKey = `doc-${userId}-${crypto.randomUUID()}.pdf`
    const filePath = path.join(DOCUMENT_DIR, storageKey)

    // write physical file to private disk 
    await fs.writeFile(filePath, file.buffer)

    try {
        // save metadata in mongodb
        const document = await Document.create({
            owner: userId,
            originalName: sanitizedOriginalName,
            storageKey,
            mimeType: 'application/pdf',
            size: file.buffer.length
        })

        return document

    } catch (error) {
        //orphan cleanup
        await fs.unlink(filePath).catch(() => { })
        throw error
    }
}

export const listDocumentsService = async (userId) => {
    //let Mongoose sort at the database level before awaiting
    return Document.find({ owner: userId }).sort({ createdAt: -1 })
}

export const getDocumentMetadataService = async (userId, documentId) => {
    // enforce ownership: if docs belong to someone else, return null
    const document = await Document.findOne({ _id: documentId, owner: userId })
    if (!document) {
        throw new AppError('Document not found', 404)
    }
    return document
}

export const getDocumentDownloadService = async (userId, documentId) => {
    const document = await Document.findOne({ _id: documentId, owner: userId })

    if (!document) {
        throw new AppError('Document not found', 404)
    }

    const filePath = path.join(DOCUMENT_DIR, document.storageKey)

    try {
        await fs.access(filePath)
    } catch (error) {
        throw new AppError('Document physical file missing on server', 404)
    }

    return {
        filePath,
        originalName: document.originalName,
        mimeType: document.mimeType
    }
}

export const deleteDocumentService = async (userId, documentId) => {
    const document = await Document.findOneAndDelete({ _id: documentId, owner: userId })

    if (!document) {
        throw new AppError('Document not found', 404)
    }

    // Delete physical file
    const filePath = path.join(DOCUMENT_DIR, document.storageKey)
    await fs.unlink(filePath).catch(() => { })
    return document
}