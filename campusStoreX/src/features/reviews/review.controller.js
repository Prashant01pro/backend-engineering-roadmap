import catchAsync from '../../utils/catchAsync.js';
import { createReviewService, getProductReviewsService, getProductRatingStatsService, } from './review.service.js';

export const createReview = catchAsync(async (req, res) => {
    const review = await createReviewService(req.user._id, req.body);

    res.status(201).json({
        status: 'success',
        data: { review },
    });
});

export const getProductReviews = catchAsync(async (req, res) => {
    const result = await getProductReviewsService(
        req.params.productId,
        req.query
    );

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const getProductRatingStats = catchAsync(async (req, res) => {
    const stats = await getProductRatingStatsService(req.params.productId);

    res.status(200).json({
        status: 'success',
        data: stats,
    });
});