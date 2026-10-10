import catchAsync from '../../utils/catchAsync.js';
import { followUserService, unfollowUserService, getFollowersService, getFollowingService, } from './follow.service.js';

export const followUser = catchAsync(async (req, res) => {
    const follow = await followUserService(req.user._id, req.params.userId);

    res.status(201).json({
        status: 'success',
        data: { follow },
    });

})

export const unFollowUser = catchAsync(async (req, res) => {
    const result = await unfollowUserService(req.user._id, req.params.userId);

    res.status(200).json({
        status: 'success',
        data: result,
    });
})

export const getFollowers = catchAsync(async (req, res) => {
    const data = await getFollowersService(req.params.userId, req.query);

    res.status(200).json({
        status: 'success',
        data,
    });
})

export const getFollowing = catchAsync(async (req, res) => {
    const data = await getFollowingService(req.params.userId, req.query);
    
    res.status(200).json({
        status: 'success',
        data,
    });
})