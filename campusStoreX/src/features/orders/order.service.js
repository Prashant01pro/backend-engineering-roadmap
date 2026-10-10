import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from './order.model.js';
import Payment from '../payment/payment.model.js';
import Cart from '../cart/cart.model.js';
import Inventory from '../inventory/inventory.model.js';
import StockTransaction from '../inventory/stockTransaction.model.js';
import Product from '../products/product.model.js';
import AppError from '../../utils/appError.js';

// checkoout and create order (Atomic transaction)
export const checkoutOrderService = async (userId) => {
    // fetch user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product')

    if (!cart || cart.items.length === 0) {
        throw new AppError('Your cart is empty', 400);
    }

    // start mongodb multi-document ACID transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let subtotal = 0;
        const orderItems = [];

        for (const item of cart.items) {
            const product = item.product;

            if (!product || product.status !== 'ACTIVE') {
                throw new AppError(
                    `Product ${product ? product.name : 'Unknown'} is no longer active`,
                    400
                );
            }

            // check & conditionally deduct inventory atomatically 
            const inventory = await Inventory.findOneAndUpdate(
                {
                    product: product._id,
                    quantity: { $gte: item.quantity },// guard against overselling

                },
                { $inc: { quantity: -item.quantity } },
                { returnDocument: 'after', session }
            )

            if (!inventory) {
                throw new AppError(
                    `Insufficient stock for "${product.name}". Order could not be placed.`,
                    400
                );
            }

            // If inventory quantity reaches 0, update product status to SOLD_OUT
            if (inventory.quantity === 0) {
                await Product.findByIdAndUpdate(
                    product._id,
                    { status: 'SOLD_OUT' },
                    { session }
                );
            }

            // record immutable stock audit transaction
            await StockTransaction.create(
                [{
                    product: product._id,
                    type: 'SALE',
                    quantity: item.quantity,
                    reason: `Order sale for product:${product.name}`,
                    performedBy: userId
                }],
                { session }
            );

            // snapshot line item (frozen price and name)
            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            })

            subtotal += product.price * item.quantity;
        }

        const total = subtotal;

        // create order
        const [order] = await Order.create(
            [
                {
                    user: userId,
                    items: orderItems,
                    subtotal,
                    total,
                    status: 'PLACED',
                }
            ],
            { session }
        )

        // create mock payment
        const transactionId = `TXN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        await Payment.create(
            [
                {
                    order: order._id,
                    amount: total,
                    method: 'MOCK',
                    status: 'SUCCESS',
                    transactionId
                }
            ],
            { session }
        )

        // update order status to completed
        order.status = 'COMPLETED';
        await order.save({ session })

        //Clear user's cart
        cart.items = [];
        await cart.save({ session });

        // Commit Transaction
        await session.commitTransaction();
        session.endSession();

        return order;

    } catch (error) {

        await session.abortTransaction();
        session.endSession();
        throw error;

    }
}

export const getMyOrdersService = async (userId, queryParams) => {
    const { page = 1, limit = 10 } = queryParams;
    const skip = (Number(page) - 1) * Number(limit)

    const [orders, totalCount] = await Promise.all([
        Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Order.countDocuments({ user: userId })
    ])

    return {
        orders,
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        currentPage: Number(page)
    }
}

//Get Single Order by ID
export const getOrderByIdService = async (orderId, userId) => {

    const order = await Order.findById(orderId).populate('user', 'name email');

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    // Only the order owner or admin can view
    if (order.user._id.toString() !== userId.toString()) {
        throw new AppError('Unauthorized: You can only view your own orders', 403);
    }

    const payment = await Payment.findOne({ order: orderId });
    
    return {
        order,
        payment,
    };
};