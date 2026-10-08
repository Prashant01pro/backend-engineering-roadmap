import mongoose from 'mongoose'

const specificationSchema = new mongoose.Schema(
    {
        author: {
            type: String,
            trim: true
        },
        edition: {
            type: String,
            trim: true
        },
        condition: {
            type: String,
            enum: ['NEW', 'LIKE_NEW', 'USED'],
            default: 'USED'
        },
        brand: {
            type: String,
            trim: true
        },
        // Allows flexible extra key-value pairs without breaking schema
        additionalDetails: {
            type: Map,
            of: String
        }
    },
    {
        _id: false  // Avoid generating separate _id for embedded specs
    }
)

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
            minLength: [3, 'Product name must be at least 3 characters'],
            maxLength: [100, 'Product name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Product description is required'],
            trim: true,
            maxLength: [1000, 'Description cannot exceed 1000 characters'],
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price must be positive'],
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Product must belong to a category']
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Product must have a seller'],
        },
        specifications: {
            type: specificationSchema,
            default: () => ({})
        },
        status: {
            type: String,
            enum: {
                values: ['ACTIVE', 'INACTIVE', 'SOLD_OUT'],
                message: '{VALUE} is not a valid product status',
            },
            default: 'ACTIVE',
        },
    },
    {
        timestamps:true
    }
)

// indexes for query performance
productSchema.index({category:1,status:1})
productSchema.index({seller:1});
productSchema.index({price:1});
productSchema.index({status:1});

const Product = mongoose.model('Product', productSchema);
export default Product;