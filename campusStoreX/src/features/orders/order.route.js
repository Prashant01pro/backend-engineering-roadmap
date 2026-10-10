import express from 'express';
import { checkout, getMyOrders, getOrderById, } from './order.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const orderRouter = express.Router();

orderRouter.use(authenticate);

orderRouter.post('/checkout', checkout);
orderRouter.get('/my-orders', getMyOrders);
orderRouter.get('/:id', getOrderById);

export default orderRouter;