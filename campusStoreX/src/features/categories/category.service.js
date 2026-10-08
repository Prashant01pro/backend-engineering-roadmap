import AppError from '../../utils/appError.js'
import Category from './category.model.js';

export const createCategoryService = async ({ name, description }) => {

    if (!name) {
        throw new AppError('Category name is required', 400);
    }

    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // Case-insensitive check
    })

    if (existingCategory) {
        throw new AppError('Category with this name already exists', 409);
    }

    const category = await Category.create({
        name: name,
        description: description
    })

    return category;

}

export const getAllCategoriesService = async () => {
    // only return active categories for normal catalog browsing

    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    return categories;
}

export const getCategoryByIdService = async (id) => {
    const category = await Category.findById(id);

    if (!category) {
        throw new AppError('Category not found', 404);
    }
    return category;
}

export const updateCategoryService = async (id, updateData) => {
    const category = await Category.findByIdAndUpdate(id, updateData,
        { returnDocument: 'after', runValidators: true }
    );


    if (!category) {
        throw new AppError('Category not found', 404);
    }
    return category;

}