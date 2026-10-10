import mongoose from 'mongoose';
import Inventory from './inventory.model.js';
import StockTransaction from './stockTransaction.model.js';
import Product from '../products/product.model.js';
import AppError from '../../utils/appError.js';

// initialize or add stock (seller action)
export const addStockService = async ({ productId, sellerId, quantity, reason }) => {
    if (!quantity || quantity <= 0) {
        throw new AppError('Quantity must be greater than 0', 400);
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError('Product not found', 404);
    }

    // only the product seller can add stock
    if (product.seller.toString() !== sellerId.toString()) {
        throw new AppError('Unauthorized: Only the seller can update stock', 403);
    }

    //A MongoDB session is a grouping of related read or write operations tracked by the database to support causal consistency and multi-document ACID transactions.
    // Use MongoDB Session / Transaction to guarantee both inventory and transaction are saved together

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // upsert inventory (create if not exists, otherwise increment quantity)
        const inventory = await Inventory.findOneAndUpdate(
            { product: productId },
            { $inc: { quantity: quantity } },
            { upsert: true, new: true, setDefaultsOnInsert: true, session }
        );

        // if product was SOLD_OUT and now has stock , make it ACTIVE
        if (product.status === 'SOLD_OUT') {
            product.status = 'ACTIVE';
            await product.save({ session });
        }

        // Record the immutable transaction 
        await StockTransaction.create(
            [
                {
                    product: productId,
                    type: 'PURCHASE',
                    quantity,
                    reason: reason || 'seller added stock',
                    performedBy: sellerId
                }
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return inventory;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }

}

// Get Inventory by Product ID
export const getInventoryByProductService = async (productId) => {

    const inventory = await Inventory.findOne({ product: productId }).populate('product', 'name price status');

    if (!inventory) {
        throw new AppError('Inventory record not found for this product', 404);
    }
    return inventory;
};

// Get Stock Transaction History for a Product (Audit Log)
export const getProductStockHistoryService = async (productId, sellerId) => {

    const product = await Product.findById(productId);

    if (!product) {
        throw new AppError('Product not found', 404);
    }


    // Only the product's seller can inspect its stock audit ledger
    if (product.seller.toString() !== sellerId.toString()) {
        throw new AppError('Unauthorized: Only the seller can view stock history', 403);
    }

    const transactions = await StockTransaction.find({ product: productId })
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 });

    return transactions;
};