import Product from "./product.model.js";
import Category from '../categories/category.model.js'
import AppError from '../../utils/appError.js'

// create product : any authenticated student
export const createProductService = async (sellerId, productData) => {
    const { name, description, price, category, specifications } = productData;

    if (!name || !description || price === undefined || !category) {
        throw new AppError('Name, description, price, and category are required', 400);
    }

    const categoryExists = await Category.findOne({ _id: category, isActive: true });

    if (!categoryExists) {
        throw new AppError('Invalid or inactive category', 400);
    }

    const product = await Product.create({
        name,
        description,
        price,
        category,
        seller: sellerId,
        specifications: specifications || {},
        status: 'ACTIVE'
    })

    return product;
}

//Get All Products (With filtering, sorting & pagination)

export const getAllProductsService = async (queryParams) => {
    const { category, minPrice, maxPrice, search, sortBy = 'createdAt', order = 'desc', page = 1, limit = 10 } = queryParams;

    const filter = { status: 'ACTIVE' };

    if (category) {
        filter.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
        filter.price = {};

        if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
        if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
        // regex search on name or description
        filter.$or = [
            {
                name: { $regex: search, $options: 'i' },
                description: { $regex: search, $options: 'i' },

            }
        ]
    }

    // pagination calculation 
    const skip = (Number(page) - 1) * Number(limit)
    const sortDirection = order === 'asc' ? 1 : -1;

    const [products, totalCount] = await Promise.all([
        Product.find(filter)
            .populate('category', 'name')
            .populate('seller', 'name email')
             .sort({ [sortBy]: sortDirection })        
            .sort(skip)
            .limit(Number(limit)),
        Product.countDocuments(filter)
    ])

    return {
        products,
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        currentPage: Number(page)
    }
}

//Get Single Product by ID
export const getProductByIdService = async (id) => {

    const product = await Product.findById(id)
        .populate('category', 'name')
        .populate('seller', 'name email bio');

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    return product;
};

export const updateProductService = async (productId, sellerId, updateData) => {

    const product = await Product.findById(productId);

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    // Ownership verification
    if (product.seller.toString() !== sellerId.toString()) {
        throw new AppError('Unauthorized: You can only edit your own products', 403);
    }

    // Prevent changing the seller or injecting unauthorized fields
    delete updateData.seller;

    // If updating category, ensure new category exists
    if (updateData.category) {
        const categoryExists = await Category.findOne({
            _id: updateData.category,
            isActive: true,
        });

        if (!categoryExists) {
            throw new AppError('Invalid or inactive category', 400);
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { returnDocument: 'after', runValidators: true }
    ).populate('category', 'name');

    return updatedProduct;
};


// 5. Delete Product (Soft Delete -> status: 'INACTIVE')
export const deleteProductService = async (productId, sellerId) => {

    const product = await Product.findById(productId);

    if (!product) {
        throw new AppError('Product not found', 404);
    }
    // Ownership check
    if (product.seller.toString() !== sellerId.toString()) {
        throw new AppError('Unauthorized: You can only delete your own products', 403);
    }
    // Soft delete: maintain historical integrity
    product.status = 'INACTIVE';
    await product.save();

    return { message: 'Product successfully deactivated' };
};

  

