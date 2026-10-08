import express from 'express';
import { createCategory, getAllCategories, getCategoryById, updateCategory, } from './category.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';

const categoryRouter = express.Router()

// Public routes
categoryRouter.get('/', getAllCategories);
categoryRouter.get('/:id', getCategoryById);


// Protected routes (Admin only)
categoryRouter.post('/', authenticate,authorize('admin'), createCategory);
categoryRouter.patch('/:id', authenticate,authorize('admin'), updateCategory);

export default categoryRouter;