import mongoose from "mongoose";

const stockTransactionSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Stock transaction must reference a product'],
            index: true
        },
        type: {
            type: String,
            required: [true, 'Transaction type is required'],
            enum: {
                values: ['PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT'],
                message: '{VALUE} is not a valid transaction type',
            }
        },
        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
            min: [1, 'Transaction quantity must be at least 1'],
        },
        reason: {
            type: String,
            trim: true,
            maxLength: [200, 'Reason cannot exceed 200 characters'],
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Transaction must record who performed it'],
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false } //Transactions are immutable!
    }

);

// compound index for querying a product's transaction history sorted by date
stockTransactionSchema.index({product:1,createdAt:-1});
const StockTransaction=mongoose.model('StockTransaction',stockTransactionSchema)
export default StockTransaction;