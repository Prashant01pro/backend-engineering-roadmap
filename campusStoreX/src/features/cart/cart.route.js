import express from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, } from './cart.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const cartRouter = express.Router();

// All cart endpoints require user authentication
cartRouter.use(authenticate);

cartRouter.get('/', getCart);
cartRouter.post('/items', addToCart);
cartRouter.patch('/items', updateCartItem);
cartRouter.delete('/items/:productId', removeCartItem);
cartRouter.delete('/clear', clearCart);

export default cartRouter;