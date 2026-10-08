import catchAsync from '../../utils/catchAsync.js';
import { createCategoryService, getAllCategoriesService, getCategoryByIdService, updateCategoryService, } from './category.service.js';


export const createCategory = catchAsync(async (req, res) => {
    const category = await createCategoryService(req.body);

    res.status(201).json({
        status: 'success',
        data: { category },
    });
});

export const getAllCategories = catchAsync(async (req, res) => {
    const categories = await getAllCategoriesService();

    res.status(200).json({
        status: 'success',
        results: categories.length,
        data: { categories },
    });
});

export const getCategoryById = catchAsync(async (req, res) => {
    const category = await getCategoryByIdService(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { category },
    });
});


export const updateCategory = catchAsync(async (req, res) => {

    const category = await updateCategoryService(req.params.id, req.body);
    res.status(200).json({
        status: 'success',
        data: { category },
    });
});