import Follow from './follow.model.js';
import User from '../auth/auth.model.js';
import AppError from '../../utils/appError.js';

// follow a user
export const followUserService = async (followerId, targetUserId) => {

    // cannot follow yourself
    if (followerId.toString() === targetUserId.toString()) {
        throw new AppError('You cannot follow yourself', 400);
    }

    // check if target user exists 
    const targetUser = await User.findById(targetUserId)
    if (!targetUser) {
        throw new AppError('User to follow not found', 404);
    }

    try {
        const follow = await Follow.create({
            follower: followerId,
            following: targetUserId
        });

        return follow;
    } catch (error) {
        if (error.code === 11000) {
            throw new AppError('You are already following this user', 409)
        }
        throw error
    }
}

// unfollow a user
export const unfollowUserService = async (followerId, targetUserId) => {
    const follow = await Follow.findOneAndDelete({
        follower: followerId,
        following: targetUserId
    })

    if (!follow) {
        throw new AppError('You are not following this user', 404);
    }

    return { message: 'Successfully unfollowed user' };
}

// get followers of a user 
export const getFollowersService = async (userId, queryParams) => {
    const { page = 1, limit = 20 } = queryParams;
    const skip = (Number(page) - 1) * Number(limit);

    const [followers, totalCount] = await Promise.all([
        Follow.find({ following: userId })
            .populate('follower', 'name email bio')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Follow.countDocuments({ following: userId })
    ])

    return {
        followers: followers.map((f) => f.follower),
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        currentPage: Number(page)
    }
}

// get following of a user
export const getFollowingService = async (userId, queryParams) => {
    const { page = 1, limit = 20 } = queryParams;
    const skip = (Number(page) - 1) * Number(limit);

    const [following, totalCount] = await Promise.all([
        Follow.find({ follower: userId })
            .populate('following', 'name email bio')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Follow.countDocuments({ follower: userId })
    ])

    return {
        following: following.map((f) => f.following),
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        currentPage: Number(page)
    }
}
