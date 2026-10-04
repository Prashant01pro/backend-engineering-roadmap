import express from 'express';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { getSystemStats, getAllUsers, getUserDetails, updateUserRole, deleteUser, adminDeleteProject, adminDeleteTask } from './admin.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', getSystemStats);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Content moderation
router.delete('/projects/:id', adminDeleteProject);
router.delete('/tasks/:id', adminDeleteTask);

export default router;