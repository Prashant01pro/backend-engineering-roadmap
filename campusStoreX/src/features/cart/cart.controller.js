import catchAsync from '../../utils/catchAsync.js';
import { getCartService, addToCartService, updateCartItemService, removeCartItemService, clearCartService, } from './cart.service.js';

export const getCart = catchAsync(async (req, res) => {

    const result = await getCartService(req.user._id);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const addToCart = catchAsync(async (req, res) => {
    const { productId, quantity } = req.body;

    const result = await addToCartService(req.user._id, { productId, quantity });

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const updateCartItem = catchAsync(async (req, res) => {
    const { productId, quantity } = req.body;

    const result = await updateCartItemService(req.user._id, {
        productId,
        quantity,
    });

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const removeCartItem = catchAsync(async (req, res) => {

    const result = await removeCartItemService(
        req.user._id,
        req.params.productId
    );

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const clearCart = catchAsync(async (req, res) => {
    const result = await clearCartService(req.user._id);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});