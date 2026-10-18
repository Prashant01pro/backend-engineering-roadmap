// import path from 'path'
// import fs from 'fs/promises'

import crypto from 'crypto'
import { storage } from '../storage/index.js'
import Share from './share.model.js'
import Document from '../documents/document.model.js'
import AppError from '../../utils/appError.js'
import { parseDeviceInfo } from '../../utils/deviceInfo.js'

//const DOCUMENT_DIR = path.resolve('uploads/documents')

export const createShareLinkService = async (userId, documentId, { expiresInHours = 24, maxAccessCount = null }) => {
    // verify the requesting user owns the document
    const document = await Document.findOne({ _id: documentId, owner: userId })
    if (!document) {
        throw new AppError('Document not found', 404)
    }

    // generate an unpredictable 64 -character raw hex token
    const rawToken = crypto.randomBytes(32).toString('hex')

    // hash token for db storage
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // calculate expiration timestamp (defaut 24 hrs max 7 days)
    const hours = Math.min(Math.max(1, Number(expiresInHours)), 168)
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

    // stores share record in mongodb
    const share = await Share.create({
        document: documentId,
        createdBy: userId,
        tokenHash,
        expiresAt,
        maxAccessCount: maxAccessCount ? Math.max(1, Number(maxAccessCount)) : null
    })

    return {
        shareId: share._id,
        rawToken, // return once to the owner so they can copy the link,
        expiresAt,
        maxAccessCount: share.maxAccessCount
    }
}

export const accessSharedDocumentService = async (rawToken, req) => {
    // hash the incoming token to query the database
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // find active, unrevoked share record
    const share = await Share.findOne({
        tokenHash,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }).populate('document')

    if (!share || !share.document) {
        throw new AppError('Share link is invalid, expired, or has been revoked', 404)
    }

    // check access count ceiling
    if (share.maxAccessCount !== null && share.accessCount >= share.maxAccessCount) {
        throw new AppError('Share link has reached its maximum download limit', 410)
    }

    // record audit log entry and increment count atomatically
    const deviceInfo = parseDeviceInfo(req)
    share.accessCount += 1
    share.accessLogs.push({
        accessedAt: new Date(),
        ip: deviceInfo.ip,
        userAgent: req.headers['user-agent'] || 'unknown'
    })

    await share.save({ validateBeforeSave: false })

    // // verify physical file exists and return stream metadata
    // const filePath = path.join(DOCUMENT_DIR, share.document.storageKey)
    // try {
    //     await fs.access(filePath)
    // } catch {
    //     throw new AppError('Physical document file not found', 404)
    // }

    //Generate signed URL for Cloudinary or fallback to stream

    const signedUrl = await storage.generateSignedUrl(share.document.storageKey, 900)
    if (signedUrl) {
        return { isRedirect: true, url: signedUrl }
    }
    const fileStream = await storage.getStream(share.document.storageKey)

    return {
        isRedirect: false,
        // filePath,
        fileStream,
        originalName: share.document.originalName,
        mimeType: share.document.mimeType
    }
}

export const listDocumentSharesService = async (userId, documentId) => {
    // verify document ownership
    const document = await Document.findOne({ _id: documentId, owner: userId })

    if (!document) {
        throw new AppError('Document not found', 404)
    }
    return Share.find({ document: documentId, createdBy: userId })
        .select('-tokenHash')
        .sort({ createdAt: -1 })
}

export const revokeShareLinkService = async (userId, shareId) => {

    const share = await Share.findOne({ _id: shareId, createdBy: userId })

    if (!share) {
        throw new AppError('Share link not found', 404)
    }

    share.isRevoked = true
    await share.save({ validateBeforeSave: false })
}