import mongoose, { mongo } from 'mongoose';

// snapshot line item
const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        name: {
            type: String,
            required: true, // Frozen at time of purchase
        },
        price: {
            type: Number,
            required: true, // Frozen at time of purchase
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: true }

    // Mongoose to create an ID—as you noted, Mongoose already does that by default. 
    // Instead, explicitly defining _id: true or _id: false is used to control subdocuments (nested schemas) or to explicitly re-enable ID generation if it was disabled at a global or parent level.

)

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Order must belong to a user'],
            index: true,
        },
        items: {
            type: [orderItemSchema],
            required: [true, 'Order must contain items'],
            validate: [(items) => items.length > 0, 'Order cannot be empty']
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: {
                values: ['PLACED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
                message: '{VALUE} is not a valid order status',
            },
            default: 'PLACED',
            index: true,
        },
    },
    {
        timestamps: true,
    }

)

// compound index for querying user order history sorted by creation data
orderSchema.index({ user: 1, createdAt: -1 });
const Order = mongoose.model('Order', orderSchema)
export default Order;