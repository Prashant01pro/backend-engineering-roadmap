import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: [true, 'Inventory must reference a product'],
            unique: true, // only 1 record inventory record per product
        },
        quantity: {
            type: Number,
            required: [true, 'Stock quantity is required'],
            min: [0, 'Quantity cannot be negative'],
            default: 0,
        },
        reserved: {
            type: Number,
            min: [0, 'Reserved quantity cannot be negative'],
            default: 0,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }

)

//The Schema#virtual() function returns a VirtualType object. 
// Unlike normal document properties, virtuals do not have any underlying value and Mongoose does not do any type coercion on virtuals. 
// However, virtuals do have getters and setters, which make them ideal for computed properties, like the domain example above.
// Virtual field: Derived state (never store what can be calculated)
inventorySchema.virtual('available').get(function (){
    return this.quantity - this.reserved;
})

// Critical Mongoose Concept: Arrow functions do NOT have their own this binding. In an arrow function, this will refer to the global/module scope (undefined in ES modules), not the Mongoose document! This will return NaN or throw a TypeError.
// You must use a regular function so Mongoose can bind this to the document instance:

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;