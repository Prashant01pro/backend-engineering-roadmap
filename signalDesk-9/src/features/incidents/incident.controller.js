import { catchAsync } from '../../utils/catchAsync.js';
import { createIncidentService, updateIncidentStatusService, assignIncidentService, addCommentService, listIncidentsService, getIncidentByIdService } from './incident.service.js';

export const createIncident = catchAsync(async (req, res) => {
    const incident = await createIncidentService(req.body, req.user._id);

    res.status(201).json({
        status: 'success',
        message: 'Incident reported successfully',
        data: { incident }
    });
});

export const listIncidents = catchAsync(async (req, res) => {
    const result = await listIncidentsService(req.query);

    res.status(200).json({
        status: 'success',
        results: result.incidents.length,
        pagination: result.pagination,
        data: { incidents: result.incidents }
    });
});

export const getIncidentById = catchAsync(async (req, res) => {
    const incident = await getIncidentByIdService(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { incident }
    });
});

export const updateIncidentStatus = catchAsync(async (req, res) => {
    const incident = await updateIncidentStatusService(req.params.id, req.body, req.user._id);

    res.status(200).json({
        status: 'success',
        message: `Incident status updated to ${incident.status}`,
        data: { incident }
    });
});

export const assignIncident = catchAsync(async (req, res) => {
    const incident = await assignIncidentService(req.params.id, req.body.assignedTo, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Incident assigned successfully',
        data: { incident }
    });
});

export const addComment = catchAsync(async (req, res) => {
    const incident = await addCommentService(req.params.id, req.body.content, req.user._id);

    res.status(201).json({
        status: 'success',
        message: 'Comment added to incident',
        data: { incident }
    });
});