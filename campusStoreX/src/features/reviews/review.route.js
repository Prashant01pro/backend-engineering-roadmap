import express from 'express';
import { createReview, getProductReviews, getProductRatingStats, } from './review.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const reviewRouter = express.Router();

// Public: View product reviews & computed average rating
reviewRouter.get('/product/:productId', getProductReviews);
reviewRouter.get('/product/:productId/stats', getProductRatingStats);

// Protected: Only verified buyers can submit a review
reviewRouter.post('/', authenticate, createReview);

export default reviewRouter;