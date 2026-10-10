import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: [true, 'Payment must reference an order'],
            unique: true // 1-1 relationship with order
        },
        amount: {
            type: Number,
            required: [true, 'Payment amount is required'],
            min: 0
        },
        method: {
            type: String,
            enum: ['MOCK'],
            default: 'MOCK'
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILED'],
            default: 'SUCCESS'
        },
        transactionId: {
            type: String,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
)

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;