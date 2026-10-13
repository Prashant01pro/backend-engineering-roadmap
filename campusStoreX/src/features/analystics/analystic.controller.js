import {catchAsync} from '../../utils/catchAsync.js';
import { getTotalSalesService, getBestSellingProductsService, getSalesByCategoryService, getSellerRevenueService, getUserSpendingService, getProductStockBreakdownService, } from './analystic.service.js';

export const getTotalSales = catchAsync(async (req, res) => {
    const data = await getTotalSalesService();

    res.status(200).json({
        status: 'success',
        data,
    });
});

export const getBestSellers = catchAsync(async (req, res) => {
    const data = await getBestSellingProductsService(req.query.limit);

    res.status(200).json({
        status: 'success',
        results: data.length,
        data,
    });
});

export const getSalesByCategory = catchAsync(async (req, res) => {
    const data = await getSalesByCategoryService();

    res.status(200).json({
        status: 'success',
        results: data.length,
        data,
    });
});

export const getSellerRevenue = catchAsync(async (req, res) => {
    // If admin passes ?sellerId=..., use it; otherwise use authenticated user's ID
    const sellerId = req.query.sellerId || req.user._id;
    const data = await getSellerRevenueService(sellerId);

    res.status(200).json({
        status: 'success',
        data,
    });
});

export const getUserSpending = catchAsync(async (req, res) => {
    const data = await getUserSpendingService(req.user._id);

    res.status(200).json({
        status: 'success',
        data,
    });
});

export const getProductStockBreakdown = catchAsync(async (req, res) => {
    const data = await getProductStockBreakdownService(req.params.productId);

    res.status(200).json({
        status: 'success',
        data,
    });
});