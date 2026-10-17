import { catchAsync } from '../../utils/catchAsync.js'
import { createShareLinkService, accessSharedDocumentService, listDocumentSharesService, revokeShareLinkService } from './share.service.js'

export const createShareLink = catchAsync(async (req, res) => {
    const { documentId } = req.params

    const result = await createShareLinkService(req.user._id, documentId, req.body)

    res.status(201).json({
        message: 'Share link created successfully',
        shareId: result.shareId,
        shareToken: result.rawToken,
        shareUrl: `${req.protocol}://${req.get('host')}/api/v1/shares/${result.rawToken}`,
        expiresAt: result.expiresAt,
        maxAccessCount: result.maxAccessCount
    })
})

export const accessSharedDocument = catchAsync(async (req, res) => {
    const { shareToken } = req.params
    const { filePath, originalName, mimeType } = await accessSharedDocumentService(shareToken, req)
    
    // Security headers for download
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(filePath)
})

export const listDocumentShares = catchAsync(async (req, res) => {
    const { documentId } = req.params
    const shares = await listDocumentSharesService(req.user._id, documentId)
    res.status(200).json({
        count: shares.length,
        shares
    })
})


export const revokeShareLink = catchAsync(async (req, res) => {
    const { shareId } = req.params
    await revokeShareLinkService(req.user._id, shareId)
    res.status(200).json({
        message: 'Share link revoked successfully'
    })
})