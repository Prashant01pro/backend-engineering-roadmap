import express from 'express';
import { followUser, unFollowUser, getFollowers, getFollowing, } from './follow.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const followRouter = express.Router();

// Public: View who follows a seller or who a student is following
followRouter.get('/:userId/followers', getFollowers);
followRouter.get('/:userId/following', getFollowing);

// Protected: Follow or unfollow a seller
followRouter.post('/:userId/follow', authenticate, followUser);
followRouter.delete('/:userId/unfollow', authenticate, unFollowUser);

export default followRouter;