import { catchAsync } from '../../utils/catchAsync.js';
import AppError from '../../utils/appError.js';
import { uploadEvidenceService, getIncidentEvidenceService, deleteEvidenceService } from './evidence.service.js';

export const uploadEvidence = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload an evidence image file', 400));
    }

    const evidence = await uploadEvidenceService(
        {
            incidentId: req.params.incidentId,
            fileBuffer: req.file.buffer,
            originalName: req.file.originalname,
            caption: req.body.caption
        },
        req.user._id
    );

    res.status(201).json({
        status: 'success',
        message: 'Evidence processed and uploaded successfully',
        data: { evidence }
    });
});

export const getIncidentEvidence = catchAsync(async (req, res) => {
    const evidenceList = await getIncidentEvidenceService(req.params.incidentId, req.user._id);

    res.status(200).json({
        status: 'success',
        results: evidenceList.length,
        data: { evidence: evidenceList }
    });
});

export const deleteEvidence = catchAsync(async (req, res) => {
    await deleteEvidenceService(req.params.evidenceId, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Evidence deleted successfully'
    });
});