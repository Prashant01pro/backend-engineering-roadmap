import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
    {
        follower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Follower user ID is required'],
        },
        following: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Following user ID is required']
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false }  // immutable record
    }
)

// compound unique index: prevents duplicate follow pairs at DB levels
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// index for listing a user's followers
followSchema.index({ following: 1 })

const Follow=mongoose.model('Follow',followSchema);
export default Follow;