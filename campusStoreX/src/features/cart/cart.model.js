import mongoose from 'mongoose';

// subdocument schema for an item in the cart 
const cartItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Product reference is required']
        },
        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
            min: [1, 'Quantity must be at least 1'],
            default: 1,
        }
    },
    {
        _id: true
    }
)

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Cart must belong to a user'],
            unique: true // exactly one cart per user
        },
        items: {
            type: [cartItemSchema],
            default: [],
            validate: [
                (items) => items.length <= 20, 'Cart cannot exceed 20 different items'
            ]
        }
    },
    {
        timestamps: true
    }
)

const Cart=mongoose.model('Cart',cartSchema);
export default Cart