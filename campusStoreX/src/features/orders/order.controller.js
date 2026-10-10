import catchAsync from '../../utils/catchAsync.js';
import { checkoutOrderService, getMyOrdersService, getOrderByIdService, } from './order.service.js';

export const checkout = catchAsync(async (req, res) => {
    const order = await checkoutOrderService(req.user._id);

    res.status(201).json({
        status: 'success',
        data: { order },
    });
});

export const getMyOrders = catchAsync(async (req, res) => {
    const result = await getMyOrdersService(req.user._id, req.query);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const getOrderById = catchAsync(async (req, res) => {
    const result = await getOrderByIdService(req.params.id, req.user._id);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});