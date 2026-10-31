import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { createIncident, listIncidents, getIncidentById, updateIncidentStatus, assignIncident, addComment } from './incident.controller.js';
import { createIncidentSchema, updateIncidentStatusSchema, assignIncidentSchema, addCommentSchema, listIncidentsQuerySchema, validate, validateQuery } from './incident.validation.js';

const router = express.Router();

router.use(authenticate);

router.route('/')
    .get(validateQuery(listIncidentsQuerySchema), listIncidents)
    .post(validate(createIncidentSchema), createIncident);

router.route('/:id')
    .get(getIncidentById);

router.route('/:id/status')
    .patch(validate(updateIncidentStatusSchema), updateIncidentStatus);

router.route('/:id/assign')
    .patch(validate(assignIncidentSchema), assignIncident);

router.route('/:id/comments')
    .post(validate(addCommentSchema), addComment);

export default router;