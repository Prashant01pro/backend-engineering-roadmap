import { catchAsync } from '../../utils/catchAsync.js'
import { uploadDocumentService, listDocumentsService, getDocumentMetadataService, getDocumentDownloadService, deleteDocumentService } from './document.service.js'

export const uploadDocument = catchAsync(async (req, res) => {
    const document = await uploadDocumentService(req.user._id, req.file)

    res.status(201).json({
        message: 'Document uploaded successfully',
        document
    })
})

export const listDocuments = catchAsync(async (req, res) => {
    const documents = await listDocumentsService(req.user._id)

    res.status(200).json({
        count: documents.length,
        documents
    })
})

export const getDocumentMetadata = catchAsync(async (req, res) => {
    const document = await getDocumentMetadataService(req.user._id, req.params.documentId)

    res.status(200).json({ document })
})

export const downloadDocument = catchAsync(async (req, res) => {
    // const { filePath, originalName, mimeType } = await getDocumentDownloadService(
    //     req.user._id,
    //     req.params.documentId
    // )

    const downloadData = await getDocumentDownloadService(
        req.user._id,
        req.params.documentId
    )
    // When Cloudinary is active, redirect browser directly to Cloudinary signed URL!
    if (downloadData.isRedirect) {
        return res.redirect(downloadData.url)
    }

    // Security Headers for Download
    res.setHeader('Content-Type', downloadData.mimeType)
    // res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`)
    res.setHeader('Content-Disposition', `attachment; filename="${downloadData.originalName}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // res.sendFile(filePath)
    downloadData.fileStream.pipe(res)
})

export const deleteDocument = catchAsync(async (req, res) => {
    await deleteDocumentService(req.user._id, req.params.documentId)

    res.status(200).json({
        message: 'Document deleted successfully'
    })
})

