import catchAsync from '../../utils/catchAsync.js';
import { createProductService, getAllProductsService, getProductByIdService, updateProductService, deleteProductService, } from './product.service.js';

export const createProduct = catchAsync(async (req, res) => {
    // req.user._id is populated by authenticate middleware
    const product = await createProductService(req.user._id, req.body);

    res.status(201).json({
        status: 'success',
        data: { product },
    });
});

export const getAllProducts = catchAsync(async (req, res) => {
    const result = await getAllProductsService(req.query);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const getProductById = catchAsync(async (req, res) => {
    const product = await getProductByIdService(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { product },
    });
});

export const updateProduct = catchAsync(async (req, res) => {
    const updatedProduct = await updateProductService(
        req.params.id,
        req.user._id,
        req.body
    );

    res.status(200).json({
        status: 'success',
        data: { product: updatedProduct },
    });
});

export const deleteProduct = catchAsync(async (req, res) => {
    const result = await deleteProductService(req.params.id, req.user._id);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});