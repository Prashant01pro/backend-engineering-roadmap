import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Review must belong to a user'],
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Review must belong to a product'],
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: [true, 'Review must be linked to a verified purchase order'],
        },
        rating: {
            type: Number,
            required: [true, 'Rating is required'],
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5'],
        },
        comment: {
            type: String,
            trim: true,
            maxLength: [500, 'Comment cannot exceed 500 characters'],
        },
    },
    {
        timestamps: true,
    }
);

// compound unique index : one review per student per product 
reviewSchema.index({ user: 1, product: 1 }, { unique: true })

// index for fast querying of a product's reviews 
reviewSchema.index({ product: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;