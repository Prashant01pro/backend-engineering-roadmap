import express from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import {createTeam,getMyTeams,getTeamById,addMember,removeMember} from './team.controller.js';
import {createTeamSchema,addMemberSchema,validate} from './team.validation.js';

const router = express.Router();

// All team routes require authentication
router.use(authenticate);

router.route('/')
    .get(getMyTeams)
    .post(validate(createTeamSchema), createTeam);

router.route('/:id')
    .get(getTeamById);

router.route('/:id/members')
    .post(validate(addMemberSchema), addMember);

router.route('/:id/members/:userId')
    .delete(removeMember);

export default router;