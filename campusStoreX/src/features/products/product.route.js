import express from 'express';
import { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, } from './product.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const productRouter = express.Router();

// Public routes: Browsing the marketplace
productRouter.get('/', getAllProducts);
productRouter.get('/:id', getProductById);

// Protected routes: Creating and managing own products
productRouter.post('/', authenticate, createProduct);
productRouter.patch('/:id', authenticate, updateProduct);
productRouter.delete('/:id', authenticate, deleteProduct);

export default productRouter;