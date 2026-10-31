import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { uploadEvidenceMiddleware, validateImageMagicBytes } from '../../middlewares/upload.middleware.js';
import { uploadEvidence, getIncidentEvidence, deleteEvidence } from './evidence.controller.js';

const router = express.Router();

router.use(authenticate);

// Evidence nested under an incident
router.route('/incidents/:incidentId/evidence')
    .get(getIncidentEvidence)
    .post(uploadEvidenceMiddleware, validateImageMagicBytes, uploadEvidence);

router.route('/evidence/:evidenceId')
    .delete(deleteEvidence);

export default router;