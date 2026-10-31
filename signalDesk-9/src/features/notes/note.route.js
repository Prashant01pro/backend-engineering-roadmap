import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { getOrCreateNote, updateNoteMetadata } from './note.controller.js';

const router = express.Router();

router.use(authenticate);

// Initialize/ Get note & collaboration credentials for an incident
router.get('/incidents/:incidentId/notes', getOrCreateNote);

// Update note title / metadata
router.patch('/notes/:id', updateNoteMetadata);

export default router;