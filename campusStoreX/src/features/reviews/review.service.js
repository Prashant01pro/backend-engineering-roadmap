import mongoose from 'mongoose';
import Review from './review.model.js';
import Order from '../orders/order.model.js';
import Product from '../products/product.model.js';
import AppError from '../../utils/appError.js';

export const createReviewService = async (userId, { productId, rating, comment }) => {
    if (!productId || rating === undefined) {
        throw new AppError('Product ID and rating are required', 400);
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError('Product not found', 404);
    }

    // check user can't review their own product 
    if (product.seller.toString() === userId.toString()) {
        throw new AppError('Sellers cannot review their own products', 400)
    }

    // verified buyer : must have a completed order containting this product to review 
    const completedOrder = await Order.findOne({
        user: userId,
        status: 'COMPLETED',
        'items.product': productId
    })

    if (!completedOrder) {
        throw new AppError(
            'You can only review products you have purchased and completed',
            403
        );
    }

    try {
        const review = await Review.create({
            user: userId,
            product: productId,
            order: completedOrder._id,
            rating,
            comment,
        });

        return review;

    } catch (error) {

        if (error.code === 11000) {
            throw new AppError('You have already reviewed this product', 409);
        }

        throw error;
    }
}

//Get All Reviews for a Product
export const getProductReviewsService = async (productId, queryParams) => {
    const { page = 1, limit = 10 } = queryParams;
    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, totalCount] = await Promise.all([
        Review.find({ product: productId })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Review.countDocuments({ product: productId }),
    ]);

    return {
        reviews,
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        currentPage: Number(page),
    };
};

//Compute Average Product Rating via Aggregation Pipeline ($match -> $group -> $avg)
export const getProductRatingStatsService = async (productId) => {
    const stats = await Review.aggregate([
        // filter reviews for this specific product 
        {
            $match: { product: new mongoose.Types.ObjectId(productId) }
        },

        // group and calculate average rating and total review count
        {
            $group: {
                _id: '$product',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ])

    if (stats.length === 0) {
        return {
            averageRating: 0,
            totalReviews: 0,
        };
    }

    return {
        averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal place (e.g. 4.2)
        totalReviews: stats[0].totalReviews,
    };
}