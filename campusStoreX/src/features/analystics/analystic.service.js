import mongoose from 'mongoose';
import Order from '../orders/order.model.js';
import StockTransaction from '../inventory/stockTransaction.model.js';
import AppError from '../../utils/appError.js';

// Total Platform Sales (Admin)
// Concept: Sum all completed order totals across the entire platform

export const getTotalSalesService = async () => {
    const result = await Order.aggregate([
        { $match: { status: 'COMPLETED' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$total' },
                totalOrdersCount: { $sum: 1 },
            }
        },
        { $project: { _id: 0, totalRevenue: 1, totalOrdersCount: 1 } },
    ])

    return result[0] || { totalRevenue: 0, totalOrdersCount: 0 }
}

// best-selling products
// Concept: $unwind array items -> $group by product -> $sum quantity -> $sort descending

export const getBestSellingProductsService = async (limit = 5) => {
    const bestSeller = await Order.aggregate([
        { $match: { status: 'COMPLETED' } },
        // deconstruct the item array into individual documents
        { $unwind: '$items' },
        // group by product Id and sum quantities and revenue
        {
            $group: {
                _id: "$items.product",
                productName: { $first: '$items.name' },
                unitsSold: { $sum: '$items.quantity' },
                totalRevenue: {
                    $sum: { $multiply: ['$items.price', '$items.quantity'] }
                }
            }
        },
        // sort by highest units sold
        { $sort: { unitsSold: -1 } },
        // top n results
        { $limit: Number(limit) }
    ])

    return bestSeller;
}

//Sales By Category
// Concept: Multi-collection joins using $lookup (Orders -> Products -> Categories)
export const getSalesByCategoryService = async () => {
    const salesByCategory = await Order.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: '$product' },

        // Join with Categories to get the human-readable category name
        {
            $lookup: {
                from: 'categories',
                localField: 'product.category',
                foreignField: '_id',
                as: 'category',
            },
        },
        { $unwind: '$category' },

        // Group by category and compute totals
        {
            $group: {
                _id: '$category._id',
                categoryName: { $first: '$category.name' },
                totalRevenue: {
                    $sum: { $multiply: ['$items.price', '$items.quantity'] },
                },
                unitsSold: { $sum: '$items.quantity' },
            },
        },
        { $sort: { totalRevenue: -1 } },
    ]);

    return salesByCategory;
}

//Seller Revenue
// Concept: Filter only order items that belong to products created by this specific seller
export const getSellerRevenueService = async (sellerId) => {
    const sellerObjId = new mongoose.Types.ObjectId(sellerId);

    const revenueData = await Order.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: '$product' },
        // Filter only items where product.seller matches
        { $match: { 'product.seller': sellerObjId } },

        {
            $group: {
                _id: '$product.seller',
                totalRevenue: {
                    $sum: { $multiply: ['$items.price', '$items.qunatity'] }
                },
                unitsSold: { $sum: '$items.quantity' },
            }
        },
        { $project: { _id: 0, totalRevenue: 1, unitsSold: 1 } }
    ]);

    return revenueData[0] || { totalRevenue: 0, unitsSold: 0 };
}


// User Spending Summary
// Concept: Sum total money spent by a student across all completed orders
export const getUserSpendingService = async (userId) => {
    const userObjId = new mongoose.Types.ObjectId(userId);

    const spending = await Order.aggregate([
        {
            $match: {
                user: userObjId,
                status: 'COMPLETED',
            },
        },
        {
            $group: {
                _id: '$user',
                totalSpent: { $sum: '$total' },
                totalOrders: { $sum: 1 },
            },
        },
        { $project: { _id: 0, totalSpent: 1, totalOrders: 1 } },
    ]);

    return spending[0] || { totalSpent: 0, totalOrders: 0 };
};

// Product Stock Breakdown by Transaction Type
// Concept: Aggregate StockTransactions to see sum of PURCHASE, SALE, RETURN, etc.
export const getProductStockBreakdownService = async (productId) => {
    const productObjId = new mongoose.Types.ObjectId(productId);

    const breakdown = await StockTransaction.aggregate([
        { $match: { product: productObjId } },
        {
            $group: {
                _id: '$type',
                totalQuantity: { $sum: '$quantity' },
                transactionCount: { $sum: 1 },
            },
        },
        {
            $project: {
                _id: 0,
                type: '$_id',
                totalQuantity: 1,
                transactionCount: 1,
            },
        },
    ]);

    return breakdown;
};









// Pipeline Flow Comparison

// Stage	     Action	                            Purpose / Outcome
// 1. $match	 Filters for status: 'COMPLETED'	Only processes finished sales; ignores pending or cancelled orders.
// 2. $unwind	 Flattens the items array	        Splits a multi-item order into separate document entries per item.
// 3. $lookup	 Joins with the products collection	Fetches the matching catalog product details for each ordered item.
// 4. $unwind	 Flattens the joined product array	Converts the fetched product array into a clean, easy-to-read object.
// 5. $group	 Bundles by $product.category	    Calculates the mathematical Total Revenue and Total Units per category.
// 6. $project	 Formats the final keys	            Cleans up the output structure, renaming _id to a readable category field.
