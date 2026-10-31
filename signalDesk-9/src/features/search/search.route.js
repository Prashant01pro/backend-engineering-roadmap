import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { searchIncidentsCursor, searchIncidentsOffset, explainSearch } from './search.controller.js';

const router = express.Router();

router.use(authenticate);

// Cursor pagination (recommended for scale)
router.get('/cursor', searchIncidentsCursor);

// Offset pagination (for comparison benchmarks)
router.get('/offset', searchIncidentsOffset);

// MongoDB .explain('executionStats') profiler
router.get('/explain', explainSearch);

export default router;