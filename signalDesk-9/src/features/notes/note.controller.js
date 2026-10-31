import { catchAsync } from '../../utils/catchAsync.js';
import { getOrCreateNoteService, updateNoteMetadataService } from './note.service.js';

export const getOrCreateNote = catchAsync(async (req, res) => {
    const result = await getOrCreateNoteService(req.params.incidentId, req.user._id);

    res.status(200).json({
        status: 'success',
        data: result
    });
});

export const updateNoteMetadata = catchAsync(async (req, res) => {
    const note = await updateNoteMetadataService(req.params.id, req.body, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Note metadata updated',
        data: { note }
    });
});