import express from 'express';
import { getTotalSales, getBestSellers, getSalesByCategory, getSellerRevenue, getUserSpending, getProductStockBreakdown, } from './analystic.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';

const analyticsRouter = express.Router();

analyticsRouter.use(authenticate);

// Student / Buyer analytics
analyticsRouter.get('/my-spending', getUserSpending);

// Seller analytics
analyticsRouter.get('/my-revenue', getSellerRevenue);
analyticsRouter.get('/product-stock-breakdown/:productId', getProductStockBreakdown);

// Public / Platform analytics (or Admin only)
analyticsRouter.get('/best-sellers', getBestSellers);
analyticsRouter.get('/sales-by-category', getSalesByCategory);
analyticsRouter.get('/total-sales', authorize('admin'), getTotalSales);

export default analyticsRouter;